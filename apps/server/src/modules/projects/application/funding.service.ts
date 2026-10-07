import { Injectable } from '@nestjs/common';
import type { ProjectStatus } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, Money } from '../../../platform/kernel';
import { applyFundingDelta } from '../domain/funding';
import { assertCurrency, isPublished, type ProjectRecord } from '../domain/project';
import { ProjectFunded, ProjectUpdated, TierUnlocked } from '../domain/project-events';
import { ProjectEventsRecorder } from './project-events.recorder';
import { ProjectRepository } from './ports';

export interface FundingSnapshot {
  projectId: string;
  status: ProjectStatus;
  collected: Money;
  contributionCount: number;
}

/**
 * Collected amounts, for the payments module (ADR 0038, ADR 0039): a paid contribution is
 * applied once and reversed once, idempotently by its identifier, under a lock of the project
 * row. Applying updates the total, unlocks the reached tiers, and makes the project funded
 * when the goal is reached; the first one locks the amounts.
 */
@Injectable()
export class FundingService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly events: ProjectEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  applyFunding(contributionId: string, projectId: string, amount: Money): Promise<FundingSnapshot> {
    return this.transactions.run(async () => {
      const project = await this.lockProject(projectId);
      const existing = await this.projects.findFundingEntry(contributionId);
      if (existing) {
        if (
          existing.projectId !== projectId ||
          existing.amountMinor !== amount.amountMinor ||
          existing.currency !== amount.currency
        ) {
          throw new DomainError(
            'PROJECTS_CONTRIBUTION_CONFLICT',
            'The contribution was already applied with other values',
          );
        }
        return snapshot(project);
      }
      if (!isPublished(project)) {
        throw new DomainError('PROJECTS_NOT_OPEN', 'The project is not published');
      }
      assertCurrency(amount.currency);
      if (amount.amountMinor <= 0n) {
        throw new DomainError('VALIDATION_FAILED', 'A contribution amount is positive');
      }
      const now = this.clock.now();
      await this.projects.insertFundingEntry({
        contributionId,
        projectId,
        amountMinor: amount.amountMinor,
        currency: amount.currency,
        appliedAt: now,
        reversedAt: null,
      });
      return this.change(project, amount.amountMinor, 1, now);
    });
  }

  reverseFunding(contributionId: string): Promise<FundingSnapshot> {
    return this.transactions.run(async () => {
      const entry = await this.projects.findFundingEntry(contributionId);
      if (!entry) {
        throw new DomainError('PROJECTS_CONTRIBUTION_NOT_FOUND', 'Contribution not found');
      }
      const project = await this.lockProject(entry.projectId);
      if (entry.reversedAt) return snapshot(project);
      const now = this.clock.now();
      await this.projects.markFundingReversed(contributionId, now);
      return this.change(project, -entry.amountMinor, -1, now);
    });
  }

  private async change(
    project: ProjectRecord,
    deltaMinor: bigint,
    countDelta: number,
    now: Date,
  ): Promise<FundingSnapshot> {
    const tiers = await this.projects.tiersOf(project.id);
    const change = applyFundingDelta(
      {
        status: project.status,
        collectedMinor: project.collectedMinor,
        goalMinor: project.goalMinor,
      },
      tiers,
      deltaMinor,
    );
    const contributionCount = project.contributionCount + countDelta;
    await this.projects.updateProject(
      project.id,
      {
        collectedMinor: change.collectedMinor,
        contributionCount,
        status: change.status,
        firstContributionAt: project.firstContributionAt ?? now,
        ...(change.funded ? { fundedAt: now } : {}),
        ...(change.backToFunding ? { fundedAt: null } : {}),
      },
      now,
    );
    await this.projects.markTiersUnlocked(change.unlockedTierIds, now);
    for (const tier of tiers.filter((candidate) => change.unlockedTierIds.includes(candidate.id))) {
      await this.events.record(TierUnlocked, project.id, {
        tierId: tier.id,
        position: tier.position,
        thresholdMinor: String(tier.thresholdMinor),
        currency: project.currency,
      });
    }
    if (change.funded) {
      await this.events.record(ProjectFunded, project.id, {
        collectedMinor: String(change.collectedMinor),
        goalMinor: String(project.goalMinor ?? 0n),
        currency: project.currency,
      });
    }
    if (change.backToFunding) {
      await this.events.record(ProjectUpdated, project.id, { fields: ['status'] });
    }
    return {
      projectId: project.id,
      status: change.status,
      collected: Money.of(change.collectedMinor, project.currency),
      contributionCount,
    };
  }

  private async lockProject(projectId: string): Promise<ProjectRecord> {
    const project = await this.projects.lockProject(projectId);
    if (!project || project.deletedAt) {
      throw new DomainError('PROJECTS_NOT_FOUND', 'Project not found');
    }
    return project;
  }
}

function snapshot(project: ProjectRecord): FundingSnapshot {
  return {
    projectId: project.id,
    status: project.status,
    collected: Money.of(project.collectedMinor, project.currency),
    contributionCount: project.contributionCount,
  };
}

import { Injectable } from '@nestjs/common';
import type { ProjectStatus } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, Money } from '../../../platform/kernel';
import { applyFundingDelta } from '../domain/funding';
import { assertCurrency, isPublished, type ProjectRecord } from '../domain/project';
import { ProjectFunded, ProjectUpdated, TierUnlocked } from '../domain/project-events';
import { ProjectEventsRecorder } from './project-events.recorder';
import { ProjectRepository } from './ports';

export interface FundingReversal {
  /** Identifier of the refund or dispute in the payments module. */
  reversalId: string;
  amount: Money;
}

export interface FundingSnapshot {
  projectId: string;
  status: ProjectStatus;
  collected: Money;
  contributionCount: number;
}

/**
 * Collected amounts, for the payments module (ADR 0038, ADR 0039): a paid contribution is
 * applied once by its identifier and reversed in one or several parts, each once by its own
 * identifier, under a lock of the project row. Applying updates the total, unlocks the reached tiers, and makes the project funded
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
        reversedMinor: 0n,
        reversedAt: null,
      });
      return this.change(project, amount.amountMinor, 1, now);
    });
  }

  /**
   * Reverses all or part of an applied contribution (partial refund, lost dispute), once per
   * reversal identifier. Without a reversal, the remaining amount is reversed under the
   * identifier of the contribution. The contribution stops counting when fully reversed.
   */
  reverseFunding(contributionId: string, reversal?: FundingReversal): Promise<FundingSnapshot> {
    return this.transactions.run(async () => {
      const found = await this.projects.findFundingEntry(contributionId);
      if (!found) {
        throw new DomainError('PROJECTS_CONTRIBUTION_NOT_FOUND', 'Contribution not found');
      }
      const project = await this.lockProject(found.projectId);
      // Read again under the lock of the project: a concurrent reversal may have won.
      const entry = (await this.projects.findFundingEntry(contributionId)) ?? found;
      const reversalId = reversal?.reversalId ?? contributionId;
      const remaining = entry.amountMinor - entry.reversedMinor;
      const amountMinor = reversal?.amount.amountMinor ?? remaining;
      const existing = await this.projects.findFundingReversal(reversalId);
      if (existing) {
        const same =
          existing.contributionId === contributionId &&
          (!reversal || existing.amountMinor === reversal.amount.amountMinor);
        if (!same) {
          throw new DomainError(
            'PROJECTS_CONTRIBUTION_CONFLICT',
            'The reversal was already applied with other values',
          );
        }
        return snapshot(project);
      }
      if (!reversal && remaining === 0n) return snapshot(project);
      if (reversal && reversal.amount.currency !== entry.currency) {
        throw new DomainError('PROJECTS_CURRENCY_NOT_SUPPORTED', 'Reversal in another currency');
      }
      if (amountMinor <= 0n || amountMinor > remaining) {
        throw new DomainError(
          'PROJECTS_REVERSAL_INVALID',
          'A reversal is positive and at most the amount not yet reversed',
        );
      }
      const now = this.clock.now();
      const fullyReversed = amountMinor === remaining;
      await this.projects.insertFundingReversal(
        { reversalId, contributionId, amountMinor, currency: entry.currency, reversedAt: now },
        fullyReversed,
      );
      return this.change(project, -amountMinor, fullyReversed ? -1 : 0, now);
    });
  }

  /** Collected amount and number of contributions of a project, for the payments module. */
  async snapshotOf(projectId: string): Promise<FundingSnapshot | null> {
    const project = await this.projects.findProject(projectId);
    return project && !project.deletedAt ? snapshot(project) : null;
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

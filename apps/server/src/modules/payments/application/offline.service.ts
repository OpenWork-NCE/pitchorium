import { Injectable } from '@nestjs/common';
import type {
  CursorPage,
  DeclareOfflineContributionRequest,
  OfflineContribution,
  OfflineContributionStatus,
} from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { TransactionManager } from '../../../platform/database';
import {
  Clock,
  decodeKeyset,
  DomainError,
  encodeKeyset,
  IdGenerator,
  Money,
} from '../../../platform/kernel';
import { MediaFacade } from '../../media';
import { ProfilesFacade } from '../../profiles';
import { ProjectsFacade } from '../../projects';
import { eurEquivalent, fixedRate } from '../domain/fx';
import { offlineValidated } from '../domain/ledger';
import {
  assertOfflineAmount,
  assertOfflineTransition,
  counterpartOf,
  isMonetary,
  type OfflineContributionRecord,
} from '../domain/offline';
import {
  OfflineContributionConfirmed,
  OfflineContributionDeclared,
  OfflineContributionRejected,
  OfflineContributionValidated,
} from '../domain/payments-events';
import { offlineView } from './payments-views';
import { PaymentsEventsRecorder } from './payments-events.recorder';
import { PaymentsRepository } from './ports';

/** Resource of the supporting documents of an off-platform contribution (media, private). */
export const OFFLINE_CONTRIBUTION_RESOURCE = 'offline_contribution';

const notFound = () =>
  new DomainError('PAYMENTS_OFFLINE_NOT_FOUND', 'Off-platform contribution not found');

/**
 * Off-platform contributions (section 9.3 fallback, ADR 0049): cash, institutional transfer,
 * love money commitment without money, skills sponsorship. Declared by one party, confirmed by
 * the other; money counts in the collected amount only once an administrator validates it on a
 * supporting document. « Money is real, or it is not shown » (section 4).
 */
@Injectable()
export class OfflineService {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly projects: ProjectsFacade,
    private readonly profiles: ProfilesFacade,
    private readonly media: MediaFacade,
    private readonly events: PaymentsEventsRecorder,
    private readonly audit: AuditService,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** By the contributor, or by an owner of the project for a member (`contributorId`). */
  async declare(
    declarerId: string,
    projectId: string,
    request: DeclareOfflineContributionRequest,
    contributorHandle?: string,
  ): Promise<OfflineContribution> {
    const project = await this.projects.fundable(projectId);
    if (!project?.showable) throw new DomainError('PROJECTS_NOT_FOUND', 'Project not found');
    const byHolder = contributorHandle !== undefined;
    const contributorId = byHolder
      ? await this.profiles.userIdOf(contributorHandle, declarerId)
      : declarerId;
    if (!contributorId || (byHolder && contributorId === declarerId)) {
      throw new DomainError('IDENTITY_USER_NOT_FOUND', 'Contributor not found');
    }
    if (!byHolder && (await this.projects.teamRoleOf(projectId, declarerId)) === 'owner') {
      throw new DomainError('FORBIDDEN', 'The owners declare for a contributor');
    }
    const amount = request.amount ? Money.fromJSON(request.amount) : undefined;
    assertOfflineAmount(request.kind, amount);
    const now = this.clock.now();
    const rate = amount ? fixedRate(amount.currency, now) : null;
    const record: OfflineContributionRecord = {
      id: this.ids.next(),
      projectId,
      contributorId,
      declaredBy: byHolder ? 'holder' : 'contributor',
      declarerId,
      kind: request.kind,
      status: 'declared',
      amountMinor: amount?.amountMinor ?? null,
      currency: amount?.currency ?? null,
      eurMinor: amount && rate ? eurEquivalent(amount, rate).amountMinor : null,
      description: request.description ?? null,
      proofMediaIds: [],
      confirmedAt: null,
      confirmedBy: null,
      decidedAt: null,
      decidedBy: null,
      decisionReason: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.transactions.run(async () => {
      await this.payments.insertOffline(record);
      await this.events.record(OfflineContributionDeclared, record.id, {
        projectId,
        kind: record.kind,
        by: declarerId,
        declaredBy: record.declaredBy,
      });
    });
    return this.view(record);
  }

  /** The other party confirms (`confirmed`) or rejects (`rejected`, with a reason). */
  async respond(
    id: string,
    userId: string,
    answer: 'confirmed' | 'rejected',
    reason?: string,
  ): Promise<OfflineContribution> {
    const record = await this.transactions.run(async () => {
      const current = await this.payments.lockOffline(id);
      if (!current) throw notFound();
      if (current.status !== 'declared' || !(await this.isCounterpart(current, userId))) {
        throw new DomainError(
          'PAYMENTS_OFFLINE_INVALID_TRANSITION',
          'Only the other party answers a declaration',
        );
      }
      assertOfflineTransition(current, answer);
      const now = this.clock.now();
      const patch: Partial<OfflineContributionRecord> =
        answer === 'confirmed'
          ? { status: 'confirmed', confirmedAt: now, confirmedBy: userId, updatedAt: now }
          : {
              status: 'rejected',
              decidedAt: now,
              decidedBy: userId,
              decisionReason: reason ?? null,
              updatedAt: now,
            };
      await this.payments.updateOffline(id, patch);
      const payload = { projectId: current.projectId, kind: current.kind, by: userId };
      await (answer === 'confirmed'
        ? this.events.record(OfflineContributionConfirmed, id, payload)
        : this.events.record(OfflineContributionRejected, id, payload));
      return { ...current, ...patch };
    });
    return this.view(record);
  }

  /** Supporting documents (private media), added by either party before the validation. */
  async addProofs(
    id: string,
    userId: string,
    mediaIds: readonly string[],
  ): Promise<OfflineContribution> {
    const record = await this.transactions.run(async () => {
      const current = await this.payments.lockOffline(id);
      if (!current) throw notFound();
      if (
        !(await this.isParty(current, userId)) ||
        current.status === 'validated' ||
        current.status === 'rejected'
      ) {
        throw new DomainError(
          'PAYMENTS_OFFLINE_INVALID_TRANSITION',
          'Proofs are added by a party before the decision',
        );
      }
      for (const mediaId of mediaIds) {
        await this.media.attach({
          mediaId,
          ownerId: userId,
          usage: 'verification_document',
          resource: { type: OFFLINE_CONTRIBUTION_RESOURCE, id },
        });
      }
      const proofMediaIds = [...new Set([...current.proofMediaIds, ...mediaIds])];
      await this.payments.updateOffline(id, { proofMediaIds, updatedAt: this.clock.now() });
      return { ...current, proofMediaIds };
    });
    return this.view(record);
  }

  /**
   * Validation by an administrator, on proof (monetary kinds only): the amount enters the
   * collected amount of the project and the ledger.
   */
  async decide(
    id: string,
    adminId: string,
    decision: 'validated' | 'rejected',
    reason: string,
  ): Promise<OfflineContribution> {
    const record = await this.transactions.run(async () => {
      const current = await this.payments.lockOffline(id);
      if (!current) throw notFound();
      assertOfflineTransition(current, decision);
      if (decision === 'validated' && current.proofMediaIds.length === 0) {
        throw new DomainError(
          'PAYMENTS_OFFLINE_PROOF_REQUIRED',
          'A supporting document is required',
        );
      }
      const now = this.clock.now();
      const patch: Partial<OfflineContributionRecord> = {
        status: decision,
        decidedAt: now,
        decidedBy: adminId,
        decisionReason: reason,
        updatedAt: now,
      };
      await this.payments.updateOffline(id, patch);
      const payload = { projectId: current.projectId, kind: current.kind, by: adminId };
      if (decision === 'validated' && isMonetary(current.kind)) {
        const eurMinor = current.eurMinor ?? 0n;
        await this.payments.insertLedgerEntry({
          ...offlineValidated(
            {
              id,
              projectId: current.projectId,
              amountMinor: current.amountMinor ?? 0n,
              currency: current.currency ?? 'EUR',
              eurMinor,
            },
            { occurredAt: now },
          ),
          id: this.ids.next(),
          recordedAt: now,
        });
        await this.projects.applyFunding(id, current.projectId, Money.of(eurMinor, 'EUR'));
        await this.events.record(OfflineContributionValidated, id, {
          ...payload,
          eurMinor: eurMinor.toString(),
        });
      } else {
        await this.events.record(OfflineContributionRejected, id, payload);
      }
      await this.audit.record({
        actor: { type: 'user', id: adminId },
        action: `payments.offline-${decision}`,
        target: { type: OFFLINE_CONTRIBUTION_RESOURCE, id },
        metadata: { reason, proofs: current.proofMediaIds.length },
      });
      return { ...current, ...patch };
    });
    return this.view(record);
  }

  async list(
    filter: { projectId?: string; contributorId?: string; status?: OfflineContributionStatus },
    query: { cursor?: string | undefined; limit: number },
  ): Promise<CursorPage<OfflineContribution>> {
    const rows = await this.payments.offlineContributions(
      filter,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const pageRows = rows.slice(0, query.limit);
    const last = pageRows.at(-1);
    return {
      items: await this.views(pageRows),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.createdAt, key: last.id })
          : null,
    };
  }

  /** The contributor or an owner of the project. */
  async isParty(record: OfflineContributionRecord, userId: string): Promise<boolean> {
    if (record.contributorId === userId) return true;
    return (await this.projects.teamRoleOf(record.projectId, userId)) === 'owner';
  }

  private async isCounterpart(record: OfflineContributionRecord, userId: string): Promise<boolean> {
    return counterpartOf(record) === 'contributor'
      ? record.contributorId === userId
      : (await this.projects.teamRoleOf(record.projectId, userId)) === 'owner';
  }

  private async view(record: OfflineContributionRecord): Promise<OfflineContribution> {
    const [view] = await this.views([record]);
    if (!view) throw notFound();
    return view;
  }

  async views(rows: readonly OfflineContributionRecord[]): Promise<OfflineContribution[]> {
    const [projects, cards] = await Promise.all([
      this.projects.fundables([...new Set(rows.map((row) => row.projectId))]),
      this.profiles.memberCards(rows.map((row) => row.contributorId)),
    ]);
    return rows.flatMap((row) => {
      const project = projects.get(row.projectId);
      return project ? [offlineView(row, project, cards.get(row.contributorId))] : [];
    });
  }
}

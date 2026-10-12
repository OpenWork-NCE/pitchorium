import { Injectable } from '@nestjs/common';
import {
  type AdminContribution,
  type AdminContributionSearchQuery,
  type CursorPage,
  type LedgerEntry,
  type ProjectContribution,
  type RefundPreview,
  type RefundPreviewRequest,
  uuidV7Schema,
} from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { decodeKeyset, DomainError, encodeKeyset, Money } from '../../../platform/kernel';
import { ProfilesFacade } from '../../profiles';
import { ProjectsFacade } from '../../projects';
import { isRefundable, remainingMinor } from '../domain/contribution';
import { EUR } from '../domain/fx';
import { refundAmountOf, refundEffect } from '../domain/refund';
import { ContributionsService, contributionNotFound } from './contributions.service';
import { refundView } from './payments-views';
import { type ContributionFilter, type LedgerEntryRecord, PaymentsRepository } from './ports';
import { pendingRefundsMinor } from './refunds.service';

function ledgerView(entry: LedgerEntryRecord): LedgerEntry {
  return {
    id: entry.id,
    kind: entry.kind,
    occurredAt: entry.occurredAt.toISOString(),
    lines: entry.lines.map((line) => ({
      account: line.account,
      amount: Money.of(line.amountMinor, line.currency).toJSON(),
    })),
  };
}

/**
 * The contributions as an administrator reads them (§13): searched by identifier, contributor
 * or payment reference at the provider, each with its quote, its refunds and its ledger, and
 * the effect of a refund computed before it is asked. The readings are audited.
 */
@Injectable()
export class AdminContributionsService {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly contributions: ContributionsService,
    private readonly profiles: ProfilesFacade,
    private readonly projects: ProjectsFacade,
    private readonly audit: AuditService,
  ) {}

  async search(
    actorId: string,
    query: AdminContributionSearchQuery,
  ): Promise<CursorPage<ProjectContribution>> {
    const filter: ContributionFilter = query.status ? { status: query.status } : {};
    if (query.q) {
      const text = query.q.trim();
      if (uuidV7Schema.safeParse(text).success) filter.id = text;
      else {
        const contributorId = await this.profiles.userIdOf(text);
        if (contributorId) filter.contributorId = contributorId;
        else filter.providerPaymentId = text;
      }
    }
    const rows = await this.payments.contributions(
      filter,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    await this.audit.record({
      actor: { type: 'user', id: actorId },
      action: 'payments.contributions-searched',
      target: { type: 'contribution_search', id: (query.q ?? query.status ?? 'all').slice(0, 64) },
      metadata: { results: page.length },
    });
    const last = page.at(-1);
    return {
      items: await this.contributions.projectViews(page),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.createdAt, key: last.id })
          : null,
    };
  }

  async detail(actorId: string, contributionId: string): Promise<AdminContribution> {
    const row = await this.payments.findContribution(contributionId);
    if (!row) throw contributionNotFound();
    const [[view], refunds, ledger] = await Promise.all([
      this.contributions.projectViews([row]),
      this.payments.refundsOf(row.id),
      this.payments.ledgerOf(row.id),
    ]);
    if (!view) throw contributionNotFound();
    await this.audit.record({
      actor: { type: 'user', id: actorId },
      action: 'payments.contribution-viewed',
      target: { type: 'contribution', id: row.id },
    });
    const refundable = isRefundable(row.status)
      ? Money.of(remainingMinor(row) - pendingRefundsMinor(refunds), row.currency).toJSON()
      : null;
    return {
      ...view,
      refundable,
      refunds: refunds.map(refundView),
      ledger: ledger.map(ledgerView),
    };
  }

  /**
   * What a refund would do, by the rules of the refund (domain/refund.ts), before it is asked:
   * the amount, the commission given back, the euros removed from the project, the state that
   * follows. Refunds still pending are deducted from what remains.
   */
  async preview(contributionId: string, request: RefundPreviewRequest): Promise<RefundPreview> {
    const contribution = await this.payments.findContribution(contributionId);
    if (!contribution) throw contributionNotFound();
    if (!isRefundable(contribution.status)) {
      throw new DomainError(
        'PAYMENTS_INVALID_TRANSITION',
        `Cannot refund a ${contribution.status} contribution`,
      );
    }
    const pending = pendingRefundsMinor(await this.payments.refundsOf(contributionId));
    const amount = refundAmountOf(contribution, request.amount, pending);
    const effect = refundEffect(contribution, amount.amountMinor);
    const snapshot = await this.projects.fundingSnapshot(contribution.projectId);
    const money = (minor: bigint) => Money.of(minor, contribution.currency).toJSON();
    const euros = (minor: bigint) => Money.of(minor, EUR).toJSON();
    return {
      amount: amount.toJSON(),
      refundable: money(remainingMinor(contribution) - pending),
      full: effect.full,
      statusAfter: effect.status,
      commissionRefunded: money(effect.commissionMinor),
      fundingReversed: euros(effect.eurMinor),
      project: snapshot
        ? {
            collected: snapshot.collected.toJSON(),
            collectedAfter: Money.of(
              snapshot.collected.amountMinor - effect.eurMinor,
              snapshot.collected.currency,
            ).toJSON(),
          }
        : null,
      rewardReleased: effect.rewardReleased,
    };
  }
}

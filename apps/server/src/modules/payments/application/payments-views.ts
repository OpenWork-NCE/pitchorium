import type {
  Contribution,
  OfflineContribution,
  ProjectContribution,
  Refund,
} from '@pitchorium/contracts';
import { Money } from '../../../platform/kernel';
import type { OrganizationSummary } from '../../profiles';
import type { MemberCard } from '../../profiles';
import type { FundableProject } from '../../projects';
import type { ContributionRecord } from '../domain/contribution';
import { EUR } from '../domain/fx';
import type { OfflineContributionRecord } from '../domain/offline';
import type { RefundRecord } from './ports';

const iso = (date: Date | null) => date?.toISOString() ?? null;

export function contributionView(row: ContributionRecord, project: FundableProject): Contribution {
  const money = (minor: bigint) => Money.of(minor, row.currency).toJSON();
  return {
    id: row.id,
    project: { id: project.id, slug: project.slug, title: project.title },
    organizationId: row.organizationId,
    kind: row.kind,
    status: row.status,
    method: row.method,
    amount: money(row.amountMinor),
    eurEquivalent: Money.of(row.eurMinor, EUR).toJSON(),
    rate: {
      unitsPerEur: row.rateUnitsPerEur,
      source: row.rateSource,
      at: row.rateAt.toISOString(),
    },
    commission: money(row.commissionMinor - row.commissionRefundedMinor),
    commissionRateBps: row.commissionRateBps,
    providerFee: row.providerFeeMinor === null ? null : money(row.providerFeeMinor),
    refunded: money(row.refundedMinor),
    rewardId: row.rewardId,
    rewardState: row.rewardState,
    publicDisplay: row.publicDisplay,
    anonymous: row.anonymous,
    paymentUrl: row.status === 'pending_payment' ? row.paymentUrl : null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    succeededAt: iso(row.succeededAt),
  };
}

export function projectContributionViews(
  rows: readonly ContributionRecord[],
  base: readonly Contribution[],
  cards: ReadonlyMap<string, MemberCard>,
  organizations: ReadonlyMap<string, OrganizationSummary>,
): ProjectContribution[] {
  const byId = new Map(base.map((view) => [view.id, view]));
  return rows.flatMap((row) => {
    const view = byId.get(row.id);
    if (!view) return [];
    const card = row.anonymous ? undefined : cards.get(row.contributorId);
    const organization = row.organizationId ? organizations.get(row.organizationId) : undefined;
    return [
      {
        ...view,
        contributor: card
          ? {
              handle: card.handle,
              displayName: card.displayName,
              headline: card.headline,
              avatarUrl: card.avatarUrl,
            }
          : null,
        organization: organization
          ? { id: organization.id, slug: organization.slug, title: organization.name }
          : null,
      },
    ];
  });
}

export function refundView(refund: RefundRecord): Refund {
  const money = (minor: bigint) => Money.of(minor, refund.currency).toJSON();
  return {
    id: refund.id,
    contributionId: refund.contributionId,
    amount: money(refund.amountMinor),
    commissionRefunded: money(refund.commissionMinor),
    status: refund.status,
    reason: refund.reason,
    createdAt: refund.createdAt.toISOString(),
  };
}

export function offlineView(
  row: OfflineContributionRecord,
  project: FundableProject,
  contributor: MemberCard | undefined,
): OfflineContribution {
  return {
    id: row.id,
    project: { id: project.id, slug: project.slug, title: project.title },
    kind: row.kind,
    status: row.status,
    amount:
      row.amountMinor !== null && row.currency
        ? Money.of(row.amountMinor, row.currency).toJSON()
        : null,
    eurEquivalent: row.eurMinor !== null ? Money.of(row.eurMinor, EUR).toJSON() : null,
    declaredBy: row.declaredBy,
    contributor: contributor
      ? {
          handle: contributor.handle,
          displayName: contributor.displayName,
          headline: contributor.headline,
          avatarUrl: contributor.avatarUrl,
        }
      : null,
    description: row.description,
    proofMediaIds: row.proofMediaIds,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: iso(row.confirmedAt),
    decidedAt: iso(row.decidedAt),
    decisionReason: row.decisionReason,
  };
}

import {
  MONETARY_OFFLINE_KINDS,
  type OfflineContributionKind,
  type OfflineContributionStatus,
} from '@pitchorium/contracts';
import { DomainError, type Money } from '../../../platform/kernel';
import { FIXED_PARITIES } from './fx';

export interface OfflineContributionRecord {
  id: string;
  projectId: string;
  contributorId: string;
  declaredBy: 'contributor' | 'holder';
  declarerId: string;
  kind: OfflineContributionKind;
  status: OfflineContributionStatus;
  amountMinor: bigint | null;
  currency: string | null;
  eurMinor: bigint | null;
  description: string | null;
  proofMediaIds: string[];
  confirmedAt: Date | null;
  confirmedBy: string | null;
  decidedAt: Date | null;
  decidedBy: string | null;
  decisionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function isMonetary(kind: OfflineContributionKind): boolean {
  return (MONETARY_OFFLINE_KINDS as readonly string[]).includes(kind);
}

/**
 * Cash and institutional transfers carry an amount in EUR or in CFA francs, converted at the
 * fixed parity (exact); the commitments and the skills sponsorship never do (ADR 0049).
 */
export function assertOfflineAmount(
  kind: OfflineContributionKind,
  amount: Money | undefined,
): void {
  const monetary = isMonetary(kind);
  const convertible =
    amount !== undefined && (amount.currency === 'EUR' || amount.currency in FIXED_PARITIES);
  if (monetary ? !convertible : amount !== undefined) {
    throw new DomainError(
      'PAYMENTS_OFFLINE_AMOUNT_INVALID',
      'An amount in EUR, XOF or XAF is required for money only',
    );
  }
}

/** The party who answers a declaration: the other one. */
export function counterpartOf(record: OfflineContributionRecord): 'contributor' | 'holder' {
  return record.declaredBy === 'contributor' ? 'holder' : 'contributor';
}

const TRANSITIONS: Readonly<
  Record<OfflineContributionStatus, readonly OfflineContributionStatus[]>
> = {
  declared: ['confirmed', 'rejected'],
  confirmed: ['validated', 'rejected'],
  validated: [],
  rejected: [],
};

export function assertOfflineTransition(
  record: OfflineContributionRecord,
  to: OfflineContributionStatus,
): void {
  const allowed =
    TRANSITIONS[record.status].includes(to) &&
    // Only money is validated by an administrator; the rest ends at the confirmation.
    (to !== 'validated' || isMonetary(record.kind)) &&
    (record.status !== 'confirmed' || isMonetary(record.kind));
  if (!allowed) {
    throw new DomainError(
      'PAYMENTS_OFFLINE_INVALID_TRANSITION',
      `An off-platform ${record.kind} cannot go from ${record.status} to ${to}`,
    );
  }
}

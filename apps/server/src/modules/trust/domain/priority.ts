import type { ModerationCaseOrigin, ReportReason, ReportTargetType } from '@pitchorium/contracts';

/**
 * Priority of a case in the moderation queue (higher first, then the oldest). Fraud on a
 * project that collects contributions comes before everything else: money is at stake.
 */
export const REASON_WEIGHTS: Readonly<Record<ReportReason, number>> = {
  illegal_content: 80,
  fraud: 70,
  harassment: 60,
  intellectual_property: 40,
  misleading_information: 40,
  spam: 20,
  other: 10,
};
export const SIGNAL_WEIGHT = 30;
export const FUNDING_FRAUD_PRIORITY = 1_000;
/** Each report beyond the first adds this much, up to the cap. */
export const REPORT_COUNT_BONUS = 5;
export const REPORT_COUNT_BONUS_MAX = 50;

const FUNDED_TARGETS: ReadonlySet<ReportTargetType> = new Set(['project', 'project_update']);

export interface PriorityInput {
  targetType: ReportTargetType;
  origin: ModerationCaseOrigin;
  reasons: readonly ReportReason[];
  reportCount: number;
  /** The project (or the project of the update) collects contributions. */
  fundingActive: boolean;
}

export interface Priority {
  priority: number;
  /** Readable reasons of the priority, for the moderators. */
  reasons: string[];
}

export function priorityOf(input: PriorityInput): Priority {
  const reasons: string[] = [];
  let base = 0;
  if (input.origin === 'signal') {
    base = SIGNAL_WEIGHT;
    reasons.push('signal');
  }
  for (const reason of new Set(input.reasons)) {
    base = Math.max(base, REASON_WEIGHTS[reason]);
  }
  const strongest = [...new Set(input.reasons)].sort(
    (a, b) => REASON_WEIGHTS[b] - REASON_WEIGHTS[a],
  )[0];
  if (strongest) reasons.push(`reason:${strongest}`);
  if (
    input.fundingActive &&
    FUNDED_TARGETS.has(input.targetType) &&
    input.reasons.includes('fraud')
  ) {
    base = FUNDING_FRAUD_PRIORITY;
    reasons.unshift('funding_fraud');
  }
  const bonus = Math.min(
    Math.max(input.reportCount - 1, 0) * REPORT_COUNT_BONUS,
    REPORT_COUNT_BONUS_MAX,
  );
  if (bonus > 0) reasons.push(`reports:${input.reportCount}`);
  return { priority: base + bonus, reasons };
}

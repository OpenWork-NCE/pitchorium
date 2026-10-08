import { DomainError } from '../../../platform/kernel';

/** Share of the monthly cap at which the alert is raised. */
export const CAP_WARNING_RATIO = 0.8;

export function charactersOf(fields: Readonly<Record<string, string>>): number {
  return Object.values(fields).reduce((sum, text) => sum + text.length, 0);
}

export interface Budget {
  memberToday: number;
  memberDailyLimit: number;
  month: number;
  monthlyCap: number;
}

/** The limit of the member first, then the global cap of the month (cost control). */
export function budgetRefusal(budget: Budget, characters: number): DomainError | null {
  if (budget.memberToday + characters > budget.memberDailyLimit) {
    return new DomainError('LOCALIZATION_MEMBER_LIMIT_REACHED', 'Daily translation limit reached');
  }
  if (budget.month + characters > budget.monthlyCap) {
    return new DomainError('LOCALIZATION_MONTHLY_CAP_REACHED', 'Monthly translation cap reached');
  }
  return null;
}

/** True when the new total crosses the warning ratio of the cap. */
export function crossesWarning(before: number, after: number, cap: number): boolean {
  const threshold = cap * CAP_WARNING_RATIO;
  return before < threshold && after >= threshold;
}

export interface LocaleReadinessInput {
  complete: boolean;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

/**
 * A locale is activated only when its catalogue is complete and its human review approved,
 * with the reviewer and the date (« une langue mal traduite vaut mieux absente », §4).
 */
export function localeActivatable(input: LocaleReadinessInput): boolean {
  return (
    input.complete &&
    (input.status === 'reviewed' || input.status === 'source') &&
    (input.status === 'source' || (Boolean(input.reviewedBy) && Boolean(input.reviewedAt)))
  );
}

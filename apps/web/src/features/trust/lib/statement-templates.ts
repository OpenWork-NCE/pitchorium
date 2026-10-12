import type { ModerationDecisionKind, ModerationGround, ReportReason } from '@pitchorium/contracts';

/** The reasons of a report (`REPORT_REASONS` of the contracts, copied: no Zod in the console). */
export const REPORT_REASON_KEYS = [
  'spam',
  'harassment',
  'fraud',
  'illegal_content',
  'misleading_information',
  'intellectual_property',
  'other',
] as const satisfies readonly ReportReason[];

/** A template of statement of reasons: one by reason, and one for a dismissal (ADR 0174). */
export type StatementTemplateKey = ReportReason | 'dismiss';

/**
 * The template the decision form starts from: a dismissal says that no measure is taken, any
 * other decision the facts its reason describes. The moderator completes and edits it.
 */
export function statementTemplateKey(
  kind: ModerationDecisionKind,
  reason: ReportReason | null,
): StatementTemplateKey {
  if (kind === 'dismiss') return 'dismiss';
  return reason ?? 'other';
}

/** The ground a template starts from: the law for illegal content, the terms otherwise. */
export function defaultGround(reason: ReportReason | null): ModerationGround {
  return reason === 'illegal_content' ? 'law' : 'terms';
}

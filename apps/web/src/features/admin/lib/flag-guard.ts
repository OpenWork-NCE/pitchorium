import type { FeatureFlagView } from '@pitchorium/contracts';

/** Why the api will refuse to enable a flag now, as its guardrail says (ADR 0077, ADR 0051). */
export type FlagBlock = 'catalog_incomplete' | 'review_missing';

export interface FlagGuardState {
  /** The api refuses to enable it now; null when nothing blocks. */
  blocked: FlagBlock | null;
  /** Enabling asks for the reference of a legal validation. */
  legalReferenceRequired: boolean;
  /** An enabled funding instrument still has no online payment (no licensed adapter). */
  offlineOnly: boolean;
}

/**
 * What the screen of a flag shows of its guardrail, read from what the api gives (`guard`):
 * a locale is blocked unless the api says it can be activated, by its first missing step; a
 * funding flag needs a legal reference and says whether payment online exists. Disabling is
 * never blocked.
 */
export function flagGuardState(flag: Pick<FeatureFlagView, 'enabled' | 'guard'>): FlagGuardState {
  const guard = flag.guard;
  if (guard?.kind === 'locale') {
    const blocked =
      flag.enabled || guard.status.activatable
        ? null
        : guard.status.catalog.complete
          ? 'review_missing'
          : 'catalog_incomplete';
    return { blocked, legalReferenceRequired: false, offlineOnly: false };
  }
  if (guard?.kind === 'legal') {
    return {
      blocked: null,
      legalReferenceRequired: !flag.enabled,
      offlineOnly: !guard.onlinePaymentAvailable,
    };
  }
  return { blocked: null, legalReferenceRequired: false, offlineOnly: false };
}

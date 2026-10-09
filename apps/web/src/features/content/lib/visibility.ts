import type { PostVisibility } from '@pitchorium/contracts';

/** Audiences in the order of the composer, the default one in the middle (ADR 0031). */
export const VISIBILITIES: readonly PostVisibility[] = ['public', 'members', 'connections'];
export const DEFAULT_VISIBILITY: PostVisibility = 'members';

/** An audience of the composer, and why it is not available when it is not. */
export interface VisibilityOption {
  value: PostVisibility;
  disabled: boolean;
  /** Code of the reason, for the text of the composer. */
  reason: 'publicPageDisabled' | 'repostAudience' | null;
}

/**
 * Audiences the composer offers. The api decides (ADR 0031): a public publication needs the
 * public page of its author; a repost never widens the audience of the original (public: any;
 * members: members or connections; connections: by its author only). The composer only shows
 * the way, with the reason of each audience it cannot offer.
 */
export function visibilityOptions(context: {
  publicPageEnabled: boolean;
  /** Visibility of the original, for a repost. */
  original?: { visibility: PostVisibility; byReader: boolean } | null;
}): VisibilityOption[] {
  const { original } = context;
  return VISIBILITIES.map((value) => {
    if (value === 'public' && !context.publicPageEnabled) {
      return { value, disabled: true, reason: 'publicPageDisabled' };
    }
    const widened =
      original &&
      ((original.visibility === 'members' && value === 'public') ||
        (original.visibility === 'connections' && (!original.byReader || value !== 'connections')));
    return widened
      ? { value, disabled: true, reason: 'repostAudience' }
      : { value, disabled: false, reason: null };
  });
}

/** The audience chosen when the composer opens: the default one, or the widest left. */
export function initialVisibility(options: readonly VisibilityOption[]): PostVisibility | null {
  const available = options.filter((option) => !option.disabled);
  return (
    available.find((option) => option.value === DEFAULT_VISIBILITY)?.value ??
    available[0]?.value ??
    null
  );
}

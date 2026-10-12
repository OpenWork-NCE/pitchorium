import type { ImpactLabels, Locale } from '@pitchorium/contracts';

/** A translator of the `reference` namespace read with keys the api gives (`labelKey`). */
export interface ReferenceLabels {
  (key: string): string;
  has: (key: string) => boolean;
}

/**
 * The text of a label of a methodology (ADR 0173): the one an administrator wrote for the
 * language of the page, else the key translated by the catalogue (ADR 0036); a key without a
 * translation yet shows as itself rather than breaking the page.
 */
export function labelOf(
  reference: ReferenceLabels,
  key: string,
  stored?: ImpactLabels,
  locale?: string,
): string {
  const written = locale ? stored?.[locale as Locale] : undefined;
  if (written) return written;
  return reference.has(key) ? reference(key) : key;
}

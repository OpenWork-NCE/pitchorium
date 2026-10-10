/** A translator of the `reference` namespace read with keys the api gives (`labelKey`). */
export interface ReferenceLabels {
  (key: string): string;
  has: (key: string) => boolean;
}

/**
 * The text of a key of a methodology: its labels are translated, not stored (ADR 0036); a key
 * without a translation yet shows as itself rather than breaking the page.
 */
export function labelOf(reference: ReferenceLabels, key: string): string {
  return reference.has(key) ? reference(key) : key;
}

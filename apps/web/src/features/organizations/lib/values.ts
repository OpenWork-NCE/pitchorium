/** A text left empty is absent: null for the api, which clears it (patterns.md). */
export const orNull = (value: string | null | undefined): string | null =>
  value === undefined || value === null || value.trim() === '' ? null : value;

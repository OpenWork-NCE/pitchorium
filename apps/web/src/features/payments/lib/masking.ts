/** Characters left readable at the end of a bank account or mobile number (ADR 0140). */
export const VISIBLE_DIGITS = 4;

/**
 * A bank account or mobile money number as the interface shows it once typed: only its last
 * four characters, the rest replaced by a dot each, spaces ignored. A value of four characters or
 * fewer is entirely hidden: showing it would show all of it.
 */
export function maskAccountNumber(value: string): string {
  const compact = value.replace(/\s+/g, '');
  if (compact.length <= VISIBLE_DIGITS) return '•'.repeat(compact.length);
  return `${'•'.repeat(compact.length - VISIBLE_DIGITS)}${compact.slice(-VISIBLE_DIGITS)}`;
}

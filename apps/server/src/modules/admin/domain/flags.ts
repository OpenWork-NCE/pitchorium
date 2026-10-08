import { type Locale, LOCALES } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

/**
 * Funding flags that need a recorded legal validation to be enabled (§9.5, ADR 0051); even
 * enabled, the payments module refuses to collect them without a licensed adapter.
 */
export const LEGALLY_GUARDED_FLAGS: readonly string[] = ['funding.equity', 'funding.loans'];

/** The locale of a `locale.<code>` flag, null for any other flag. */
export function localeOfFlag(key: string): Locale | null {
  const code = key.startsWith('locale.') ? key.slice('locale.'.length) : null;
  return code && (LOCALES as readonly string[]).includes(code) ? (code as Locale) : null;
}

export function assertLegalReference(
  key: string,
  enabled: boolean,
  reference: string | null,
): void {
  if (enabled && LEGALLY_GUARDED_FLAGS.includes(key) && !reference) {
    throw new DomainError('ADMIN_LEGAL_REFERENCE_REQUIRED', 'Legal validation reference required');
  }
}

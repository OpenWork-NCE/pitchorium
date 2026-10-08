import { describe, expect, it } from 'vitest';
import { assertLegalReference, localeOfFlag } from './flags';

describe('feature flag guardrails', () => {
  it('needs a legal reference to enable equity or loans, never to disable them', () => {
    expect(() => assertLegalReference('funding.equity', true, null)).toThrow(
      expect.objectContaining({ code: 'ADMIN_LEGAL_REFERENCE_REQUIRED' }),
    );
    expect(() =>
      assertLegalReference('funding.loans', true, 'Avis du cabinet X, 2026-11-02'),
    ).not.toThrow();
    expect(() => assertLegalReference('funding.equity', false, null)).not.toThrow();
    expect(() => assertLegalReference('locale.sw', true, null)).not.toThrow();
  });

  it('recognizes the locale flags handed to the localization module', () => {
    expect(localeOfFlag('locale.sw')).toBe('sw');
    expect(localeOfFlag('locale.xx')).toBeNull();
    expect(localeOfFlag('funding.equity')).toBeNull();
  });
});

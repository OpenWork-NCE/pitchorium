import type { FeatureFlagView } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { flagGuardState } from './flag-guard';

const locale = (
  enabled: boolean,
  complete: boolean,
  review: string,
  activatable: boolean,
): Pick<FeatureFlagView, 'enabled' | 'guard'> => ({
  enabled,
  guard: {
    kind: 'locale',
    status: {
      locale: 'wo',
      enabled,
      catalog: { total: 100, missing: complete ? 0 : 12, complete },
      review: { status: review, reviewedBy: null, reviewedAt: null },
      activatable,
    },
  },
});

describe('flagGuardState', () => {
  it('blocks a locale by its first missing step, as long as the api says it cannot be activated', () => {
    expect(flagGuardState(locale(false, false, 'empty', false)).blocked).toBe('catalog_incomplete');
    expect(flagGuardState(locale(false, true, 'pending-review', false)).blocked).toBe(
      'review_missing',
    );
    expect(flagGuardState(locale(false, true, 'reviewed', true)).blocked).toBeNull();
  });

  it('never blocks turning a flag off', () => {
    expect(flagGuardState(locale(true, false, 'empty', false)).blocked).toBeNull();
  });

  it('asks a legal reference to enable equity or loans, and says payment online is absent', () => {
    const legal = (enabled: boolean, onlinePaymentAvailable: boolean) =>
      flagGuardState({
        enabled,
        guard: { kind: 'legal', legalReferenceRequired: true, onlinePaymentAvailable },
      });
    expect(legal(false, false)).toEqual({
      blocked: null,
      legalReferenceRequired: true,
      offlineOnly: true,
    });
    expect(legal(true, true)).toEqual({
      blocked: null,
      legalReferenceRequired: false,
      offlineOnly: false,
    });
  });

  it('lets a flag without guardrail change freely', () => {
    expect(flagGuardState({ enabled: false, guard: null })).toEqual({
      blocked: null,
      legalReferenceRequired: false,
      offlineOnly: false,
    });
  });
});

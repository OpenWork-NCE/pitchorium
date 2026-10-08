import { describe, expect, it } from 'vitest';
import { glossaryApplies, supports } from './provider-languages';
import {
  budgetRefusal,
  charactersOf,
  crossesWarning,
  localeActivatable,
} from './translation-rules';

describe('localization rules', () => {
  it('counts the characters and refuses beyond the member limit, then the monthly cap', () => {
    expect(charactersOf({ title: 'Palier', text: 'Un mécène' })).toBe(15);
    const budget = { memberToday: 90, memberDailyLimit: 100, month: 900, monthlyCap: 1000 };
    expect(budgetRefusal(budget, 10)).toBeNull();
    expect(budgetRefusal(budget, 11)?.code).toBe('LOCALIZATION_MEMBER_LIMIT_REACHED');
    expect(budgetRefusal({ ...budget, month: 995 }, 10)?.code).toBe(
      'LOCALIZATION_MONTHLY_CAP_REACHED',
    );
  });

  it('warns once, when the month crosses 80 % of the cap', () => {
    expect(crossesWarning(700, 799, 1000)).toBe(false);
    expect(crossesWarning(799, 800, 1000)).toBe(true);
    expect(crossesWarning(800, 900, 1000)).toBe(false);
  });

  it('activates a locale only complete and humanly reviewed, with reviewer and date', () => {
    const reviewed = {
      complete: true,
      status: 'reviewed',
      reviewedBy: 'A. Mwangi',
      reviewedAt: '2026-10-01',
    };
    expect(localeActivatable(reviewed)).toBe(true);
    expect(localeActivatable({ ...reviewed, complete: false })).toBe(false);
    expect(localeActivatable({ ...reviewed, reviewedBy: null })).toBe(false);
    expect(localeActivatable({ ...reviewed, status: 'pending-review' })).toBe(false);
    expect(localeActivatable({ ...reviewed, status: 'empty' })).toBe(false);
  });

  it('routes a language to a provider that offers it, the glossary to the pairs it supports', () => {
    expect(supports('deepl', 'fr', 'en')).toBe(true);
    expect(supports('google', 'wo', 'fr')).toBe(false);
    expect(supports('google', null, 'en')).toBe(true);
    expect(glossaryApplies('deepl', 'fr', 'en')).toBe(true);
    expect(glossaryApplies('deepl', null, 'en')).toBe(false);
    expect(glossaryApplies('google', 'fr', 'en')).toBe(false);
  });
});

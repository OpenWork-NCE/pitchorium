import type { ContributorFacet } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../platform/kernel';
import {
  assertContributorFacet,
  assertEligibleCompanyCountry,
  isEligibleCompanyCountry,
} from './facet-rules';
import { assertHandleAllowed, handleBaseFromName } from './handle';
import { DEFAULT_VISIBILITY, type Profile } from './profile';
import { PROFILE_STRENGTH_WEIGHTS, profileStrength } from './profile-strength';

function codeOf(run: () => void): string | undefined {
  try {
    run();
  } catch (error) {
    if (error instanceof DomainError) return error.code;
    throw error;
  }
  return undefined;
}

const emptyProfile: Profile = {
  base: {
    userId: 'user-1',
    handle: 'amina',
    displayName: '',
    headline: null,
    bio: null,
    countryCode: null,
    city: null,
    languages: [],
    links: { website: null, linkedin: null },
    avatarUrl: null,
    avatarMediaId: null,
    coverMediaId: null,
    intention: null,
    visibility: DEFAULT_VISIBILITY,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  entrepreneur: null,
  contributor: null,
};

const contributor: ContributorFacet = {
  hats: ['mentor'],
  structureType: 'individual',
  organizationName: null,
  organizationId: null,
  interventionCountryCodes: [],
  sectorCodes: [],
  ticket: null,
  acceptedInstruments: [],
  patronageTypes: [],
  mentoringAvailable: true,
  openToExpertMissions: false,
};

describe('profile strength', () => {
  it('weighs 100 in total', () => {
    expect(Object.values(PROFILE_STRENGTH_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(
      100,
    );
  });

  it('lists missing elements heaviest first and maps percent to a level', () => {
    expect(profileStrength(emptyProfile)).toEqual({
      level: 'beginner',
      percent: 0,
      missing: [
        'avatar',
        'headline',
        'bio',
        'facet',
        'display_name',
        'location',
        'languages',
        'links',
        'cover',
        'intention',
      ],
    });

    const intermediate: Profile = {
      ...emptyProfile,
      base: {
        ...emptyProfile.base,
        displayName: 'Amina',
        headline: 'CEO',
        bio: 'Bio',
        countryCode: 'SN',
      },
    };
    expect(profileStrength(intermediate)).toMatchObject({ level: 'intermediate', percent: 50 });

    const advanced: Profile = {
      ...intermediate,
      base: { ...intermediate.base, avatarUrl: 'https://example.test/a.jpg' },
      contributor,
    };
    expect(profileStrength(advanced)).toMatchObject({ level: 'advanced', percent: 80 });

    const complete: Profile = {
      ...advanced,
      base: {
        ...advanced.base,
        languages: ['fr'],
        links: { website: 'https://example.test', linkedin: null },
        coverMediaId: 'media-1',
        intention: 'both_or_exploring',
      },
    };
    expect(profileStrength(complete)).toEqual({ level: 'complete', percent: 100, missing: [] });
  });

  it('counts a blank headline as missing', () => {
    const blank: Profile = { ...emptyProfile, base: { ...emptyProfile.base, headline: '   ' } };
    expect(profileStrength(blank).missing).toContain('headline');
  });
});

describe('facet rules', () => {
  it.each([
    ['SN', '002', null, true],
    ['NG', '002', '011', true],
    ['HT', '019', '029', true],
    ['JM', '019', '029', true],
    ['FR', '150', null, false],
    ['BR', '019', '005', false],
    ['AQ', null, null, false],
  ])('company country %s eligible: %s', (code, region, intermediate, eligible) => {
    const country = { code, m49Region: region, m49IntermediateRegion: intermediate };
    expect(isEligibleCompanyCountry(country)).toBe(eligible);
    expect(codeOf(() => assertEligibleCompanyCountry(country))).toBe(
      eligible ? undefined : 'PROFILES_COMPANY_COUNTRY_NOT_ELIGIBLE',
    );
  });

  it('requires at least one contributor hat', () => {
    expect(codeOf(() => assertContributorFacet(contributor))).toBeUndefined();
    expect(codeOf(() => assertContributorFacet({ ...contributor, hats: [] }))).toBe(
      'PROFILES_CONTRIBUTOR_HAT_REQUIRED',
    );
  });

  it('requires a coherent ticket range, compared as integers', () => {
    const ticket = (min: string, max: string) => ({
      ...contributor,
      ticket: { minAmountMinor: min, maxAmountMinor: max, currency: 'EUR' },
    });
    expect(codeOf(() => assertContributorFacet(ticket('100000', '100000')))).toBeUndefined();
    expect(codeOf(() => assertContributorFacet(ticket('9', '10')))).toBeUndefined();
    expect(codeOf(() => assertContributorFacet(ticket('10', '9')))).toBe(
      'PROFILES_TICKET_RANGE_INVALID',
    );
    expect(codeOf(() => assertContributorFacet(ticket('100', '99')))).toBe(
      'PROFILES_TICKET_RANGE_INVALID',
    );
  });
});

describe('handle', () => {
  it.each([
    ['Aminata Diallo', 'aminata-diallo'],
    ['  Élodie   N’Guessan  ', 'elodie-n-guessan'],
    ['Ñandú Çağlar', 'nandu-caglar'],
    ['李', 'member'],
    ['Al', 'member'],
    ['Admin', 'member'],
    ['A very long display name that goes on and on', 'a-very-long-display'],
  ])('derives %j into %s', (name, handle) => {
    expect(handleBaseFromName(name)).toBe(handle);
  });

  it('refuses reserved and malformed handles', () => {
    expect(codeOf(() => assertHandleAllowed('amina-diallo'))).toBeUndefined();
    expect(codeOf(() => assertHandleAllowed('settings'))).toBe('PROFILES_HANDLE_RESERVED');
    expect(codeOf(() => assertHandleAllowed('Bad--Handle'))).toBe('VALIDATION_FAILED');
  });
});

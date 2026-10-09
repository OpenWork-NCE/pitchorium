import { MATCHING_RULES, type SuggestionReason } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { matchProfileOf, personProfileOf } from './match-profile';
import {
  compose,
  isSuggested,
  MATCHING_WEIGHTS,
  matchComplementary,
  matchContributor,
  matchEvent,
  matchMission,
  matchPerson,
  matchProject,
  MIN_SCORE,
  type PersonProfile,
  type ProjectProfile,
} from './matching';
import { personDocuments, type PersonSource } from './search-documents';
import {
  DOCUMENT_WEIGHTS,
  normalizeQuery,
  prefixTsQuery,
  queryTerms,
  RANK_WEIGHTS_ARRAY,
  searchScore,
} from './search-query';

const founder: PersonProfile = {
  userId: 'founder',
  name: 'Fatou',
  residenceCountry: 'FR',
  languages: ['fr', 'wo'],
  entrepreneur: {
    sector: 'agriculture_forestry_fishing',
    companyCountry: 'SN',
    needs: ['mentoring', 'funding'],
    fundingTarget: { minor: 2_000_000n, currency: 'EUR' },
  },
  contributor: null,
};

const mentor: PersonProfile = {
  userId: 'mentor',
  name: 'Amina',
  residenceCountry: 'FR',
  languages: ['fr', 'en'],
  entrepreneur: null,
  contributor: {
    hats: ['mentor', 'investor'],
    interventionCountries: ['SN', 'CI'],
    sectors: ['agriculture_forestry_fishing'],
    ticket: { min: 1_000_000n, max: 5_000_000n, currency: 'EUR' },
    instruments: ['donation', 'equity'],
    mentoringAvailable: true,
  },
};

const rules = (reasons: readonly SuggestionReason[]) => reasons.map((reason) => reason.rule);

describe('matching rules', () => {
  it('suggests a mentor to an entrepreneur who looks for one, with every applicable reason', () => {
    const match = matchPerson(founder, mentor);
    expect(rules(match.reasons)).toEqual([
      'need_matches_hat',
      'shared_sector',
      'country_in_intervention',
      'mentoring_available',
      'ticket_fits_target',
    ]);
    expect(match.score).toBe(35 + 20 + 20 + 15 + 15);
    expect(match.reasons[0]).toMatchObject({
      key: 'reasons.need_matches_hat',
      params: { need: 'mentoring', hat: 'mentor' },
    });
    // The name is shown above the reason: the reason never repeats it.
    expect(match.reasons.find((r) => r.rule === 'country_in_intervention')?.params).toEqual({
      country: 'SN',
    });
  });

  it('gives the contributor the same relation seen from their side', () => {
    const match = matchPerson(mentor, founder);
    expect(rules(match.reasons)).toEqual([
      'hat_matches_need',
      'shared_sector',
      'intervenes_in_country',
      'mentoring_wanted',
      'ticket_fits_target',
    ]);
    expect(match.reasons.find((r) => r.rule === 'ticket_fits_target')?.key).toBe(
      'reasons.ticket_fits_target.helper',
    );
  });

  it('applies each rule alone', () => {
    const helper = mentor.contributor!;
    const bare = {
      ...mentor,
      contributor: {
        ...helper,
        hats: [],
        mentoringAvailable: false,
        sectors: [],
        interventionCountries: [],
        ticket: null,
      },
    };
    expect(matchPerson(founder, bare).score).toBe(0);
    const only = (patch: Partial<NonNullable<PersonProfile['contributor']>>) =>
      rules(
        matchPerson(founder, { ...bare, contributor: { ...bare.contributor, ...patch } }).reasons,
      );
    expect(only({ hats: ['investor'] })).toEqual(['need_matches_hat']);
    expect(only({ mentoringAvailable: true })).toEqual(['mentoring_available']);
    expect(only({ sectors: ['agriculture_forestry_fishing'] })).toEqual(['shared_sector']);
    expect(only({ interventionCountries: ['SN'] })).toEqual(['country_in_intervention']);
    expect(only({ ticket: { min: 0n, max: 3_000_000n, currency: 'EUR' } })).toEqual([
      'ticket_fits_target',
    ]);
    // A ticket in another currency or that does not include the target does not apply.
    expect(only({ ticket: { min: 0n, max: 3_000_000n, currency: 'XOF' } })).toEqual([]);
    expect(only({ ticket: { min: 3_000_000n, max: 4_000_000n, currency: 'EUR' } })).toEqual([]);
  });

  it('finds complementary entrepreneurs: same country and other sector, or the reverse', () => {
    const other = (sector: string, country: string): PersonProfile => ({
      ...founder,
      userId: 'other',
      name: 'Kofi',
      entrepreneur: { ...founder.entrepreneur!, sector, companyCountry: country },
    });
    expect(rules(matchComplementary(founder, other('manufacturing', 'SN')).reasons)).toEqual([
      'same_country_other_sector',
    ]);
    expect(
      rules(matchComplementary(founder, other('agriculture_forestry_fishing', 'GH')).reasons),
    ).toEqual(['same_sector_other_country']);
    // Same sector and same country: competitors, not complementary; other both: unrelated.
    expect(matchComplementary(founder, other('agriculture_forestry_fishing', 'SN')).score).toBe(0);
    expect(matchComplementary(founder, other('manufacturing', 'GH')).score).toBe(0);
  });

  it('matches a project and a contributor on sector, countries, ticket and instruments', () => {
    const project: ProjectProfile = {
      projectId: 'p1',
      title: 'Sahel Agri',
      ownerId: 'founder',
      sector: 'agriculture_forestry_fishing',
      countries: ['SN'],
      instruments: ['donation', 'love_money'],
      goal: { minor: 2_000_000n, currency: 'EUR' },
    };
    expect(rules(matchProject(mentor, project).reasons)).toEqual([
      'shared_sector',
      'intervenes_in_country',
      'ticket_fits_target',
      'instruments_compatible',
    ]);
    const forTeam = matchContributor(project, mentor);
    expect(forTeam.reasons.map((reason) => reason.key)).toEqual([
      'reasons.shared_sector',
      'reasons.country_in_intervention.team',
      'reasons.ticket_fits_target.team',
      'reasons.instruments_compatible.team',
    ]);
  });

  it('suggests missions answering a need or fitting a hat, and events of the member', () => {
    const offer = {
      missionId: 'm1',
      title: 'Revue du plan',
      authorId: 'mentor',
      direction: 'offer' as const,
      kind: 'mentoring' as const,
      sectors: ['agriculture_forestry_fishing'],
      countries: [],
      remote: true,
      languages: ['fr'],
    };
    expect(rules(matchMission(founder, offer).reasons)).toEqual([
      'mission_matches_need',
      'shared_sector',
      'mission_reachable',
      'shared_language',
    ]);
    expect(matchMission(mentor, offer).score).toBe(0);
    expect(
      rules(matchMission(mentor, { ...offer, authorId: 'founder', direction: 'request' }).reasons),
    ).toContain('mission_matches_hat');
    const event = {
      eventId: 'e1',
      title: 'Forum',
      organizerId: 'x',
      sectors: ['agriculture_forestry_fishing'],
      countries: ['SN'],
      language: 'fr',
    };
    expect(rules(matchEvent(founder, event).reasons)).toEqual([
      'shared_sector',
      'event_in_country',
      'shared_language',
    ]);
    // A shared language alone never suggests an event.
    expect(matchEvent(founder, { ...event, sectors: [], countries: [] }).score).toBe(0);
  });

  it('keeps the weights centralized and versioned, and a rule counts once', () => {
    expect(Object.keys(MATCHING_WEIGHTS).sort()).toEqual([...MATCHING_RULES].sort());
    const reason = (rule: (typeof MATCHING_RULES)[number]): SuggestionReason => ({
      rule,
      key: `reasons.${rule}`,
      params: {},
      weight: MATCHING_WEIGHTS[rule],
    });
    const match = compose([
      reason('shared_sector'),
      reason('shared_sector'),
      null,
      reason('need_matches_hat'),
    ]);
    expect(match.score).toBe(MATCHING_WEIGHTS.shared_sector + MATCHING_WEIGHTS.need_matches_hat);
    expect(rules(match.reasons)).toEqual(['need_matches_hat', 'shared_sector']);
    expect(isSuggested(compose([reason('shared_language')]))).toBe(
      MATCHING_WEIGHTS.shared_language >= MIN_SCORE,
    );
  });
});

describe('exclusions', () => {
  it('never suggests a member to themself, nor their own project, mission or event', () => {
    expect(matchPerson(founder, founder).score).toBe(0);
    expect(matchComplementary(founder, founder).score).toBe(0);
    const ownProject: ProjectProfile = {
      projectId: 'p',
      title: 'Mine',
      ownerId: 'mentor',
      sector: 'agriculture_forestry_fishing',
      countries: ['SN'],
      instruments: [],
      goal: null,
    };
    expect(matchProject(mentor, ownProject).score).toBe(0);
    expect(matchContributor(ownProject, mentor).score).toBe(0);
    expect(
      matchEvent(founder, {
        eventId: 'e',
        title: 'Mine',
        organizerId: 'founder',
        sectors: ['agriculture_forestry_fishing'],
        countries: ['SN'],
        language: 'fr',
      }).score,
    ).toBe(0);
  });

  it('leaves out the facets whose details are private, except for their own member', () => {
    const source: PersonSource = {
      userId: 'mentor',
      handle: 'amina',
      displayName: 'Amina',
      headline: null,
      bio: null,
      countryCode: 'FR',
      city: null,
      languages: ['fr'],
      publicPageEnabled: false,
      entrepreneurVisibility: 'members',
      contributorVisibility: 'private',
      entrepreneur: null,
      contributor: {
        hats: ['mentor'],
        structureType: 'individual',
        organizationName: null,
        interventionCountryCodes: ['SN'],
        sectorCodes: ['agriculture_forestry_fishing'],
        ticket: null,
        acceptedInstruments: [],
        mentoringAvailable: true,
        openToExpertMissions: true,
      },
    };
    const record = matchProfileOf(source);
    expect(personProfileOf(record, true).contributor).toBeNull();
    expect(personProfileOf(record, false).contributor?.hats).toEqual(['mentor']);
    expect(matchPerson(founder, personProfileOf(record, true)).score).toBe(0);
  });
});

describe('search weighting', () => {
  it('ranks the name before the subtitle, the description and the labels', () => {
    expect(DOCUMENT_WEIGHTS.A).toBeGreaterThan(DOCUMENT_WEIGHTS.B);
    expect(DOCUMENT_WEIGHTS.B).toBeGreaterThan(DOCUMENT_WEIGHTS.C);
    expect(DOCUMENT_WEIGHTS.C).toBeGreaterThan(DOCUMENT_WEIGHTS.D);
    expect(RANK_WEIGHTS_ARRAY).toBe('{0.1,0.2,0.4,1}');
    // A name close to the query, typo included, wins over a description that contains it.
    const typoInName = searchScore({ textRank: 0, nameSimilarity: 0.8, namePrefix: false });
    const wordInDescription = searchScore({
      textRank: 0.2,
      nameSimilarity: 0.1,
      namePrefix: false,
    });
    expect(typoInName).toBeGreaterThan(wordInDescription);
    expect(searchScore({ textRank: 0.5, nameSimilarity: 1, namePrefix: true })).toBeGreaterThan(
      searchScore({ textRank: 0.5, nameSimilarity: 1, namePrefix: false }),
    );
  });

  it('normalizes accents and case, and turns every term into a prefix', () => {
    expect(normalizeQuery('  Énergie   SOLAIRE au Sénégal ')).toBe('energie solaire au senegal');
    expect(prefixTsQuery('irrig sahel')).toBe('irrig:* & sahel:*');
    expect(prefixTsQuery("l'énergie")).toBe('l:* & énergie:*');
    expect(prefixTsQuery(' ;; ')).toBeNull();
    expect(queryTerms('a b c d e f g h i j')).toHaveLength(8);
  });
});

describe('search documents and privacy', () => {
  const source: PersonSource = {
    userId: 'u1',
    handle: 'fatou-sow',
    displayName: 'Fatou Sow',
    headline: 'Agripreneuse',
    bio: 'Irrigation solaire',
    countryCode: 'FR',
    city: 'Lyon',
    languages: ['fr'],
    publicPageEnabled: true,
    entrepreneurVisibility: 'members',
    contributorVisibility: 'public',
    entrepreneur: {
      companyName: 'Sahel Agri',
      sectorCode: 'agriculture_forestry_fishing',
      stageCode: 'prototype',
      companyCountryCode: 'SN',
      companyCity: 'Saint-Louis',
      pitch: 'Pompes solaires',
      needs: ['funding'],
      soughtExpertise: [],
      fundingTarget: null,
    },
    contributor: null,
  };

  it('gives members the details shown to members, visitors only the public ones', () => {
    const [members, visitors] = personDocuments(source);
    expect(members?.audience).toBe('members');
    expect(members?.body).toContain('Sahel Agri');
    expect(members?.countryCodes).toEqual(['FR', 'SN']);
    expect(members?.tags).toContain('facet:entrepreneur');
    expect(visitors?.audience).toBe('public');
    expect(visitors?.body).not.toContain('Sahel Agri');
    expect(visitors?.countryCodes).toEqual(['FR']);
    expect(visitors?.tags).not.toContain('facet:entrepreneur');
  });

  it('has no public document without a public page', () => {
    expect(personDocuments({ ...source, publicPageEnabled: false }).map((d) => d.audience)).toEqual(
      ['members'],
    );
  });
});

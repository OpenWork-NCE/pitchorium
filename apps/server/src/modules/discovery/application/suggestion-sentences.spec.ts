import { MATCHING_RULES } from '@pitchorium/contracts';
import { suggestionSentenceText, translate } from '@pitchorium/i18n';
import { describe, expect, it } from 'vitest';
import {
  matchComplementary,
  matchContributor,
  matchEvent,
  matchMission,
  matchPerson,
  matchProject,
  type PersonProfile,
  type ProjectProfile,
  sentenceOf,
} from '../domain/matching';

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

/** The reasons of the rules have their texts in the `discovery` namespace (i18n). */
describe('reason sentences', () => {
  it('builds the main sentence from the two heaviest reasons', () => {
    const match = matchPerson(founder, mentor);
    const sentence = sentenceOf(match.reasons);
    expect(sentence.key).toBe('sentences.two');
    expect(sentence.clauses.map((clause) => clause.key)).toEqual([
      'reasons.need_matches_hat',
      'reasons.shared_sector',
    ]);
    expect(sentenceOf(match.reasons.slice(0, 1)).key).toBe('sentences.one');
    expect(suggestionSentenceText('fr', sentence)).toBe(
      'Suggéré parce que vous cherchez « mentorat » et Amina est mentor et que vous partagez le secteur « agriculture, sylviculture et pêche » avec Amina',
    );
    expect(suggestionSentenceText('en', sentenceOf(match.reasons.slice(2, 3)))).toBe(
      'Suggested because Amina works in your country, Senegal',
    );
  });

  it('has a French and an English text for every reason the rules produce', () => {
    const project: ProjectProfile = {
      projectId: 'p1',
      title: 'Sahel Agri',
      ownerId: 'founder',
      sector: 'agriculture_forestry_fishing',
      countries: ['SN'],
      instruments: ['donation'],
      goal: { minor: 2_000_000n, currency: 'EUR' },
    };
    const keys = new Set(
      [
        matchPerson(founder, mentor),
        matchPerson(mentor, founder),
        matchProject(mentor, project),
        matchContributor(project, mentor),
        matchComplementary(founder, {
          ...founder,
          userId: 'b',
          entrepreneur: { ...founder.entrepreneur!, sector: 'manufacturing' },
        }),
        matchComplementary(founder, {
          ...founder,
          userId: 'c',
          entrepreneur: { ...founder.entrepreneur!, companyCountry: 'GH' },
        }),
        matchMission(founder, {
          missionId: 'm',
          title: 't',
          authorId: 'x',
          direction: 'offer',
          kind: 'mentoring',
          sectors: [],
          countries: ['SN'],
          remote: false,
          languages: ['fr'],
        }),
        matchMission(mentor, {
          missionId: 'm',
          title: 't',
          authorId: 'x',
          direction: 'request',
          kind: 'mentoring',
          sectors: [],
          countries: [],
          remote: true,
          languages: [],
        }),
        matchEvent(founder, {
          eventId: 'e',
          title: 't',
          organizerId: 'x',
          sectors: [],
          countries: ['SN'],
          language: 'fr',
        }),
      ].flatMap((match) => match.reasons.map((reason) => reason.key)),
    );
    expect([...new Set([...keys].map((key) => key.split('.')[1]))].sort()).toEqual(
      [...MATCHING_RULES].sort(),
    );
    for (const key of [...keys, 'sentences.one', 'sentences.two']) {
      for (const locale of ['fr', 'en'] as const) {
        expect(translate(locale, 'discovery', key), `${locale} ${key}`).not.toBe(key);
      }
    }
  });
});

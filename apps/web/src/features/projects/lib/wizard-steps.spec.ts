import { describe, expect, it } from 'vitest';
import { isWizardStep, missingSteps, neighbours, resumeStep, stepComplete } from './wizard-steps';

const eur = (euros: number) => ({ amountMinor: String(euros * 100), currency: 'EUR' });
const draft = {
  title: 'Ferme solaire',
  summary: null as string | null,
  sectorCode: null as string | null,
  countryCodes: [] as string[],
  impactArea: null as string | null,
  description: null as string | null,
  funding: {
    goal: null,
    collected: eur(0),
    progressPercent: 0,
    contributionCount: 0,
    daysLeft: null,
    instruments: [] as string[],
    opensCapital: false,
  },
  tiers: [] as never[],
  impactAssessment: null,
  status: 'draft' as const,
  management: { durationDays: null as number | null, impactAssessmentRequired: true },
};
type Draft = Parameters<typeof stepComplete>[1];
const view = (patch: object) => ({ ...draft, ...patch }) as unknown as Draft;

describe('steps of the creation of a project', () => {
  it('knows its steps and goes from one to the next', () => {
    expect(isWizardStep('funding')).toBe(true);
    expect(isWizardStep('contribute')).toBe(false);
    expect(neighbours('essentials')).toEqual({ previous: null, next: 'story' });
    expect(neighbours('instruments')).toEqual({ previous: 'rewards', next: 'impact' });
    expect(neighbours('publish')).toEqual({ previous: 'preview', next: null });
  });

  it('resumes a draft at its first required step still incomplete', () => {
    expect(resumeStep(view({}))).toBe('essentials');
    const essentials = {
      summary: 'Résumé',
      sectorCode: 'energy',
      countryCodes: ['SN'],
      impactArea: 'Thiès',
    };
    expect(resumeStep(view(essentials))).toBe('story');
    expect(resumeStep(view({ ...essentials, description: 'Histoire' }))).toBe('funding');
    const funded = {
      ...essentials,
      description: 'Histoire',
      funding: { ...draft.funding, goal: eur(20_000), instruments: ['donation'] },
      tiers: [{}],
      management: { durationDays: 45, impactAssessmentRequired: true },
    };
    expect(resumeStep(view(funded))).toBe('impact');
    expect(missingSteps(view(funded))).toEqual(['impact']);
    expect(resumeStep(view({ ...funded, impactAssessment: { score: 72 } }))).toBe('preview');
  });

  it('needs no assessment while no methodology is published', () => {
    expect(stepComplete('impact', view({ management: { impactAssessmentRequired: false } }))).toBe(
      true,
    );
  });

  it('counts the optional steps as complete', () => {
    for (const step of ['media', 'rewards', 'team', 'preview'] as const) {
      expect(stepComplete(step, view({}))).toBe(true);
    }
    expect(stepComplete('publish', view({}))).toBe(false);
  });
});

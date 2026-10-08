import { createMissionRequestSchema } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../platform/kernel';
import {
  assertExpertHat,
  assertFields,
  assertHours,
  assertNotAJobPosting,
  canTransition,
  type EngagementRecord,
  effectiveVisibility,
  jobPostingTerm,
  type MissionRecord,
  sidesOf,
} from './mission';

const code = (run: () => unknown): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof DomainError ? error.code : 'unexpected';
  }
};

describe('engagement lifecycle', () => {
  it('goes from asked to answered, then from in progress to completed or canceled', () => {
    expect(canTransition('requested', 'accepted')).toBe(true);
    expect(canTransition('requested', 'declined')).toBe(true);
    expect(canTransition('requested', 'canceled')).toBe(true);
    expect(canTransition('accepted', 'completed')).toBe(true);
    expect(canTransition('accepted', 'canceled')).toBe(true);
    expect(canTransition('requested', 'completed')).toBe(false);
    expect(canTransition('declined', 'accepted')).toBe(false);
    expect(canTransition('completed', 'canceled')).toBe(false);
    expect(canTransition('canceled', 'accepted')).toBe(false);
  });

  it('lets the author of the mission answer whoever asked', () => {
    const engagement = { expertId: 'expert', beneficiaryId: 'founder' } as EngagementRecord;
    expect(
      sidesOf({ authorId: 'expert', direction: 'offer' } as MissionRecord, engagement),
    ).toEqual({ responderId: 'expert', requesterId: 'founder' });
    expect(
      sidesOf({ authorId: 'founder', direction: 'request' } as MissionRecord, engagement),
    ).toEqual({ responderId: 'founder', requesterId: 'expert' });
  });
});

describe('missions are not a job board', () => {
  it('refuses the vocabulary of a job posting, in French and in English', () => {
    for (const text of [
      'Poste en CDI à pourvoir',
      'Nous recrutons un comptable',
      'Rémunération selon profil',
      'Salaire attractif',
      'TJM de 500 euros',
      "Offre d'emploi : développeur",
      'Mission à temps plein',
      'Full-time position, salary negotiable',
      "We're hiring a growth lead",
      'Hourly rate to agree',
      'Paid internship in Lagos',
      'Permanent contract in Dakar',
    ]) {
      expect(jobPostingTerm(text), text).not.toBeNull();
      expect(
        code(() => assertNotAJobPosting(text)),
        text,
      ).toBe('MISSIONS_JOB_POSTING_REFUSED');
    }
  });

  it('accepts the words of a volunteer mission', () => {
    for (const text of [
      'Revue de votre plan de financement en deux sessions',
      'Mentorat sur la stratégie commerciale, bénévole',
      'Help structuring the pitch deck for an impact fund',
      "Accompagnement à l'export vers la CEDEAO",
    ]) {
      expect(jobPostingTerm(text), text).toBeNull();
    }
  });

  it('refuses any pay, rate or contract field instead of ignoring it', () => {
    const base = {
      direction: 'offer',
      title: 'Revue de plan financier',
      description: 'Deux sessions pour revoir votre plan.',
      kind: 'expertise',
      domain: 'Finance',
      format: 'session',
      estimatedHours: 2,
      mode: 'remote',
      languages: ['fr'],
    };
    expect(createMissionRequestSchema.safeParse(base).success).toBe(true);
    for (const field of ['salary', 'rate', 'contract', 'compensation']) {
      expect(createMissionRequestSchema.safeParse({ ...base, [field]: 'x' }).success, field).toBe(
        false,
      );
    }
  });

  it('keeps a packaged mission short', () => {
    expect(code(() => assertHours('session', 8))).toBeNull();
    expect(code(() => assertHours('session', 9))).toBe('MISSIONS_HOURS_EXCEEDED');
    expect(code(() => assertHours('short_mission', 80))).toBeNull();
    expect(code(() => assertHours('short_mission', 81))).toBe('MISSIONS_HOURS_EXCEEDED');
  });
});

describe('fields and authors', () => {
  const offer = {
    direction: 'offer' as const,
    mode: 'remote' as const,
    countryCodes: [],
    skills: [],
    desiredBy: null,
    capacity: 3,
  };

  it('fits the fields to the direction and the mode', () => {
    expect(code(() => assertFields(offer))).toBeNull();
    expect(code(() => assertFields({ ...offer, mode: 'on_site' }))).toBe('MISSIONS_FIELDS_INVALID');
    expect(code(() => assertFields({ ...offer, skills: ['SQL'] }))).toBe('MISSIONS_FIELDS_INVALID');
    expect(
      code(() => assertFields({ ...offer, direction: 'request', skills: ['SQL'], capacity: 1 })),
    ).toBeNull();
    expect(code(() => assertFields({ ...offer, direction: 'request', capacity: 2 }))).toBe(
      'MISSIONS_FIELDS_INVALID',
    );
  });

  it('asks the mentor hat for mentoring and the expert hat for expertise', () => {
    expect(code(() => assertExpertHat('mentoring', ['mentor']))).toBeNull();
    expect(code(() => assertExpertHat('expertise', ['mentor']))).toBe('MISSIONS_HAT_REQUIRED');
    expect(code(() => assertExpertHat('expertise', ['expert', 'investor']))).toBeNull();
    // A recruiter is a hat, not a way to publish jobs.
    expect(code(() => assertExpertHat('expertise', ['recruiter']))).toBe('MISSIONS_HAT_REQUIRED');
  });

  it('keeps a mission public only with the public page of its author', () => {
    expect(effectiveVisibility('public', true)).toBe('public');
    expect(effectiveVisibility('public', false)).toBe('members');
    expect(effectiveVisibility('members', true)).toBe('members');
  });
});

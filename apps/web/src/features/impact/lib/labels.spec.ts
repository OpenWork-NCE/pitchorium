import { describe, expect, it } from 'vitest';
import { labelOf, type ReferenceLabels } from './labels';

const reference: ReferenceLabels = Object.assign((key: string) => `catalogue:${key}`, {
  has: (key: string) => key.startsWith('impactDemo.'),
});

describe('labelOf', () => {
  it('reads the label written for the language of the page first (ADR 0173)', () => {
    expect(labelOf(reference, 'impactDemo.jobs', { fr: 'Emplois', en: 'Jobs' }, 'en')).toBe('Jobs');
  });

  it('falls back on the catalogue, then on the key itself', () => {
    expect(labelOf(reference, 'impactDemo.jobs', { fr: 'Emplois' }, 'en')).toBe(
      'catalogue:impactDemo.jobs',
    );
    expect(labelOf(reference, 'custom.jobs')).toBe('custom.jobs');
  });
});

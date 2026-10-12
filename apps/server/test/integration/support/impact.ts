import type { ImpactMethodologyDraft } from '@pitchorium/contracts';

export const ENTREPRENEUR_FACET = {
  companyName: 'Sahel Agri',
  sectorCode: 'agriculture_forestry_fishing',
  stageCode: 'prototype',
  companyCountryCode: 'SN',
};

/**
 * A methodology of the tests: keys absent from the catalogue, and labels stored for French
 * and English, the active languages of the tests (ADR 0173); not business content.
 */
export function testMethodology(name = 'Test V1'): ImpactMethodologyDraft {
  const levels = ['none', 'partial', 'full'].map((key, value) => ({
    key,
    labelKey: `test.levels.${key}`,
    labels: { fr: `Niveau ${key}`, en: `Level ${key}` },
    value,
  }));
  return {
    name,
    criteria: ['jobs', 'climate'].map((key, index) => ({
      key,
      labelKey: `test.${key}.label`,
      descriptionKey: `test.${key}.description`,
      labels: { fr: `Critère ${key}`, en: `Criterion ${key}` },
      descriptions: { fr: `Description ${key}`, en: `Description ${key}` },
      weight: index + 1,
      scale: levels,
    })),
  };
}

import type { ImpactMethodologyDraft } from '@pitchorium/contracts';

export const ENTREPRENEUR_FACET = {
  companyName: 'Sahel Agri',
  sectorCode: 'agriculture_forestry_fishing',
  stageCode: 'prototype',
  companyCountryCode: 'SN',
};

/** A methodology of the tests: its labels are translation keys, not business content. */
export function testMethodology(name = 'Test V1'): ImpactMethodologyDraft {
  const levels = [
    { key: 'none', labelKey: 'test.levels.none', value: 0 },
    { key: 'partial', labelKey: 'test.levels.partial', value: 1 },
    { key: 'full', labelKey: 'test.levels.full', value: 2 },
  ];
  return {
    name,
    criteria: ['jobs', 'climate'].map((key, index) => ({
      key,
      labelKey: `test.${key}.label`,
      descriptionKey: `test.${key}.description`,
      weight: index + 1,
      scale: levels,
    })),
  };
}

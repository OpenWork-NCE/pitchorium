import { describe, expect, it } from 'vitest';
import { isFiltered, readShowcaseFilters, showcaseQuery } from './showcase-query';

describe('filters of the showcase in the address', () => {
  it('reads the known values and leaves the others out', () => {
    expect(
      readShowcaseFilters({
        country: 'SN',
        sector: 'energy',
        status: 'funded',
        impact: '70',
        sort: 'ending_soon',
      }),
    ).toEqual({
      country: 'SN',
      sector: 'energy',
      status: 'funded',
      impact: '70',
      sort: 'ending_soon',
    });
    expect(
      readShowcaseFilters({ country: 'senegal', status: 'draft', impact: '50', sort: ['x'] }),
    ).toEqual({ country: null, sector: null, status: null, impact: null, sort: 'recent' });
  });

  it('asks the api for the filters, the impact one only with a methodology', () => {
    const filters = readShowcaseFilters({ country: 'SN', impact: '40' });
    expect(isFiltered(filters)).toBe(true);
    expect(showcaseQuery(filters, { impactAvailable: true, cursor: 'abc' })).toEqual({
      limit: 12,
      sort: 'recent',
      countryCode: 'SN',
      minImpact: 40,
      cursor: 'abc',
    });
    expect(showcaseQuery(filters, { impactAvailable: false })).toEqual({
      limit: 12,
      sort: 'recent',
      countryCode: 'SN',
    });
    expect(isFiltered(readShowcaseFilters({ sort: 'ending_soon' }))).toBe(false);
  });
});

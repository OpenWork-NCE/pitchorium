import { describe, expect, it } from 'vitest';
import { activeFilters, isFiltered, readShowcaseFilters, showcaseQuery } from './showcase-query';

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

describe('the chips of the filters in force', () => {
  const labels: Record<string, string> = { SN: 'Sénégal', energy: 'Énergie', closed: 'Clôturé' };
  const labelOf = (_key: string, value: string) => labels[value];

  it('lists each filter in force with its label, in the order of the bar', () => {
    expect(
      activeFilters({ country: 'SN', sector: 'energy', status: 'closed', impact: null }, labelOf),
    ).toEqual([
      { key: 'country', label: 'Sénégal' },
      { key: 'sector', label: 'Énergie' },
      { key: 'status', label: 'Clôturé' },
    ]);
  });

  it('shows none without filter, and keeps the code of an unknown value', () => {
    expect(
      activeFilters({ country: null, sector: null, status: null, impact: null }, labelOf),
    ).toEqual([]);
    expect(
      activeFilters({ country: 'GW', sector: null, status: null, impact: null }, labelOf),
    ).toEqual([{ key: 'country', label: 'GW' }]);
  });
});

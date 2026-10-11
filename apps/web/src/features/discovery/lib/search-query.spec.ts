import { describe, expect, it } from 'vitest';
import {
  broaderSearch,
  isFiltered,
  readSearchFilters,
  searchApiQuery,
  searchHref,
} from './search-query';

describe('readSearchFilters', () => {
  it('reads the query, the tab and the filters of the tab from the address', () => {
    const filters = readSearchFilters({
      q: '  irrigation  ',
      type: 'project',
      country: 'SN',
      sector: 'energy',
      status: 'funding',
      impact: '70',
      format: 'online',
    });
    expect(filters).toMatchObject({
      q: 'irrigation',
      type: 'project',
      country: 'SN',
      sector: 'energy',
      status: 'funding',
      impact: '70',
      // An event filter has no place in the projects tab.
      format: null,
    });
  });

  it('leaves out an unknown value instead of sending it to the api', () => {
    const filters = readSearchFilters({ type: 'jobs', country: 'senegal', status: 'draft' });
    expect(filters).toMatchObject({ type: 'all', country: null, status: null, when: 'upcoming' });
    expect(isFiltered(filters)).toBe(false);
  });
});

describe('searchApiQuery', () => {
  it('restricts the api to the kind of the tab and maps each filter to its parameter', () => {
    expect(
      searchApiQuery(
        readSearchFilters({ q: 'atelier', type: 'event', format: 'hybrid', when: 'all' }),
      ),
    ).toEqual({
      limit: 20,
      q: 'atelier',
      kinds: 'event',
      eventFormat: 'hybrid',
      includePast: 'true',
    });
    expect(
      searchApiQuery(
        readSearchFilters({
          type: 'mission',
          direction: 'offer',
          kind: 'mentoring',
          mode: 'remote',
        }),
        { impactAvailable: true, cursor: 'abc' },
      ),
    ).toEqual({
      limit: 20,
      kinds: 'mission',
      missionDirection: 'offer',
      missionKind: 'mentoring',
      missionMode: 'remote',
      cursor: 'abc',
    });
  });

  it('asks for a minimum impact only once a methodology is published', () => {
    const filters = readSearchFilters({ type: 'project', impact: '40' });
    expect(searchApiQuery(filters, { impactAvailable: false })).not.toHaveProperty('minImpact');
    expect(searchApiQuery(filters, { impactAvailable: true })).toHaveProperty('minImpact', 40);
  });
});

describe('broaderSearch', () => {
  it('drops the filters first, then keeps the longest word, then every kind', () => {
    expect(
      broaderSearch(readSearchFilters({ q: 'pompe solaire', type: 'project', country: 'SN' })),
    ).toEqual({
      q: 'pompe solaire',
      type: 'project',
    });
    expect(broaderSearch(readSearchFilters({ q: 'pompe solaire', type: 'project' }))).toEqual({
      q: 'solaire',
      type: 'project',
    });
    expect(broaderSearch(readSearchFilters({ q: 'pompe', type: 'project' }))).toEqual({
      q: 'pompe',
    });
    expect(broaderSearch(readSearchFilters({ q: 'pompe' }))).toBeNull();
  });

  it('builds a shareable address', () => {
    expect(searchHref('/search', { q: 'énergie', type: 'project' })).toBe(
      '/search?q=%C3%A9nergie&type=project',
    );
    expect(searchHref('/search', {})).toBe('/search');
  });
});

import { describe, expect, it } from 'vitest';
import { eventsApiQuery, isFiltered, myEventsQuery, readEventFilters } from './events-query';

describe('filters of the events', () => {
  it('reads the address and asks the api for upcoming events from a day', () => {
    const filters = readEventFilters(
      { format: 'hybrid', country: 'SN', from: '2026-11-01', language: 'fr' },
      false,
    );
    expect(isFiltered(filters)).toBe(true);
    expect(eventsApiQuery(filters)).toEqual({
      limit: 12,
      period: 'upcoming',
      format: 'hybrid',
      countryCode: 'SN',
      language: 'fr',
      from: '2026-11-01T00:00:00Z',
    });
  });

  it('lists the past ones without a starting day, and keeps « Mes événements » for a member', () => {
    expect(eventsApiQuery(readEventFilters({ tab: 'past', from: '2026-11-01' }, true))).toEqual({
      limit: 12,
      period: 'past',
    });
    expect(readEventFilters({ tab: 'mine' }, false).tab).toBe('upcoming');
    expect(myEventsQuery(readEventFilters({ tab: 'mine', role: 'organizer' }, true), 'c')).toEqual({
      limit: 12,
      role: 'organizer',
      cursor: 'c',
    });
  });

  it('leaves out an unknown value', () => {
    expect(
      readEventFilters({ format: 'webinar', country: 'sn', from: '1/11' }, true),
    ).toMatchObject({
      format: null,
      country: null,
      from: null,
    });
  });
});

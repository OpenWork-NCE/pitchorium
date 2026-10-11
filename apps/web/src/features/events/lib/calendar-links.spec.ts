import { describe, expect, it } from 'vitest';
import { googleCalendarUrl, mapUrl, placeText, utcStamp } from './calendar-links';

const dakar = { name: 'Impact Hub', address: 'Rue 10, Point E', city: 'Dakar', countryCode: 'SN' };

describe('calendar links', () => {
  it('writes the instants in UTC as Google and iCalendar read them', () => {
    expect(utcStamp('2026-10-14T18:00:00.000Z')).toBe('20261014T180000Z');
    expect(utcStamp('2026-10-14T19:30:00+01:00')).toBe('20261014T183000Z');
  });

  it('builds the Google Calendar template without the link of the meeting', () => {
    const url = new URL(
      googleCalendarUrl({
        title: 'Forum de l’agriculture durable',
        startsAt: '2026-10-14T18:00:00.000Z',
        endsAt: '2026-10-14T20:00:00.000Z',
        timeZone: 'Africa/Dakar',
        location: dakar,
        pageUrl: 'https://pitchorium.test/fr/events/forum',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: 'TEMPLATE',
      text: 'Forum de l’agriculture durable',
      dates: '20261014T180000Z/20261014T200000Z',
      ctz: 'Africa/Dakar',
      details: 'https://pitchorium.test/fr/events/forum',
      location: 'Impact Hub, Rue 10, Point E, Dakar',
    });
  });

  it('leaves out the place of an online event', () => {
    const url = new URL(
      googleCalendarUrl({
        title: 'Webinaire',
        startsAt: '2026-10-14T18:00:00.000Z',
        endsAt: '2026-10-14T19:00:00.000Z',
        timeZone: 'Europe/Paris',
        location: null,
        pageUrl: 'https://pitchorium.test/fr/events/webinaire',
      }),
    );
    expect(url.searchParams.has('location')).toBe(false);
  });

  it('opens the place on OpenStreetMap by its text', () => {
    expect(placeText({ ...dakar, address: null })).toBe('Impact Hub, Dakar');
    expect(mapUrl(dakar)).toBe(
      'https://www.openstreetmap.org/search?query=Impact%20Hub%2C%20Rue%2010%2C%20Point%20E%2C%20Dakar%2C%20SN',
    );
  });
});

import type { EventView } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { eventJsonLd, zonedIso } from './json-ld';

const event = {
  title: 'Forum de l’agriculture durable',
  description: '## Programme\n\nDes **ateliers** et un [site](https://example.org).',
  format: 'hybrid',
  status: 'published',
  startsAt: '2026-11-12T17:00:00.000Z',
  endsAt: '2026-11-12T19:00:00.000Z',
  timeZone: 'Europe/Paris',
  location: { name: 'Impact Hub', address: null, city: 'Dakar', countryCode: 'SN' },
  imageUrl: null,
  organizer: {
    kind: 'organization',
    organization: {
      id: 'o',
      slug: 'teranga',
      name: 'Fondation Teranga',
      logoUrl: null,
      verified: true,
    },
  },
  language: 'fr',
  capacity: 80,
} as unknown as EventView;

describe('eventJsonLd', () => {
  it('writes the dates with the offset of the zone of the event', () => {
    expect(zonedIso('2026-11-12T17:00:00.000Z', 'Europe/Paris')).toBe('2026-11-12T18:00:00+01:00');
    expect(zonedIso('2026-07-12T17:00:00.000Z', 'Europe/Paris')).toBe('2026-07-12T19:00:00+02:00');
  });

  it('describes a hybrid event with its place and its page as the virtual place', () => {
    const data = eventJsonLd(event, {
      url: 'https://pitchorium.test/fr/events/forum',
      siteUrl: 'https://pitchorium.test',
      organizerUrl: 'https://pitchorium.test/fr/organizations/teranga',
    });
    expect(data).toMatchObject({
      '@type': 'Event',
      startDate: '2026-11-12T18:00:00+01:00',
      endDate: '2026-11-12T20:00:00+01:00',
      eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      description: 'Programme Des ateliers et un site.',
      organizer: { '@type': 'Organization', name: 'Fondation Teranga' },
      isAccessibleForFree: true,
      maximumAttendeeCapacity: 80,
    });
    expect(data.location).toEqual([
      {
        '@type': 'Place',
        name: 'Impact Hub',
        address: { '@type': 'PostalAddress', addressLocality: 'Dakar', addressCountry: 'SN' },
      },
      { '@type': 'VirtualLocation', url: 'https://pitchorium.test/fr/events/forum' },
    ]);
    expect(JSON.stringify(data)).not.toContain('offers');
  });

  it('says a canceled event and an online one', () => {
    const data = eventJsonLd(
      { ...event, status: 'canceled', format: 'online', location: null },
      { url: 'u', siteUrl: 's', organizerUrl: 'o' },
    );
    expect(data).toMatchObject({
      eventStatus: 'https://schema.org/EventCancelled',
      eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
      location: { '@type': 'VirtualLocation', url: 'u' },
    });
  });
});

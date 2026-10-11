import { describe, expect, it } from 'vitest';
import { eventTimes } from './event-times';

// 18:00 in Dakar (UTC+0) on 14 October 2026, two hours long.
const START = '2026-10-14T18:00:00.000Z';
const END = '2026-10-14T20:00:00.000Z';

const plain = (text: string | null) => text?.replace(/\s/g, ' ') ?? null;

describe('eventTimes', () => {
  it('shows the hours of the event and those of a reader in another zone', () => {
    const times = eventTimes(START, END, 'Africa/Dakar', 'Europe/Paris', 'fr');
    expect(times.city).toBe('Dakar');
    expect(plain(times.time)).toBe('18:00 – 20:00');
    expect(plain(times.local)).toBe('20:00 – 22:00');
    expect(times.date).toBe('mercredi 14 octobre 2026');
  });

  it('says nothing more when the reader is in the same zone or the same offset', () => {
    expect(eventTimes(START, END, 'Africa/Dakar', 'Africa/Dakar', 'fr').local).toBeNull();
    // Abidjan and Dakar share UTC+0.
    expect(eventTimes(START, END, 'Africa/Dakar', 'Africa/Abidjan', 'fr').local).toBeNull();
    // Unknown zone of the reader: nothing converted.
    expect(eventTimes(START, END, 'Africa/Dakar', null, 'fr').local).toBeNull();
  });

  it('gives the date when the day changes for the reader', () => {
    const times = eventTimes(START, END, 'Africa/Dakar', 'Asia/Tokyo', 'en');
    expect(plain(times.local)).toMatch(/Thu, Oct 15, 3:00 – 5:00 AM/);
  });

  it('follows the summer time of each zone at the date of the event', () => {
    // In January, Paris is UTC+1 and Port-au-Prince UTC-5.
    const winter = eventTimes(
      '2027-01-20T23:00:00.000Z',
      '2027-01-21T00:30:00.000Z',
      'America/Port-au-Prince',
      'Europe/Paris',
      'fr',
    );
    expect(plain(winter.time)).toBe('18:00 – 19:30');
    expect(plain(winter.local)).toMatch(/jeu\. 21 janv\., 00:00 – 01:30/);
  });
});

import { describe, expect, it } from 'vitest';
import { registrationState, seatsLeft } from './registration';

const NOW = Date.parse('2026-10-11T10:00:00.000Z');
const future = '2026-10-14T18:00:00.000Z';
const past = '2026-10-10T18:00:00.000Z';
const member = (registration: 'registered' | 'waitlisted' | null) => ({ registration });

describe('registrationState', () => {
  it('opens a seat, then the waiting list when the event is full', () => {
    const base = { status: 'published' as const, startsAt: future, now: NOW };
    expect(registrationState({ ...base, full: false, viewer: member(null) })).toBe('open');
    expect(registrationState({ ...base, full: true, viewer: member(null) })).toBe('full');
    expect(registrationState({ ...base, full: true, viewer: null })).toBe('sign_in');
  });

  it('keeps the registration or the waiting list of the member until the start', () => {
    const base = { status: 'published' as const, startsAt: future, full: true, now: NOW };
    expect(registrationState({ ...base, viewer: member('registered') })).toBe('registered');
    expect(registrationState({ ...base, viewer: member('waitlisted') })).toBe('waitlisted');
    expect(registrationState({ ...base, startsAt: past, viewer: member('waitlisted') })).toBe(
      'closed',
    );
  });

  it('says a canceled, completed or draft event', () => {
    const base = { startsAt: future, full: false, viewer: member('registered'), now: NOW };
    expect(registrationState({ ...base, status: 'canceled' })).toBe('canceled');
    expect(registrationState({ ...base, status: 'completed', viewer: member(null) })).toBe(
      'closed',
    );
    expect(registrationState({ ...base, status: 'draft' })).toBe('draft');
  });

  it('counts the seats left of a limited event only', () => {
    expect(seatsLeft(20, 18)).toBe(2);
    expect(seatsLeft(20, 25)).toBe(0);
    expect(seatsLeft(null, 120)).toBeNull();
  });
});

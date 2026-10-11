import type { EventStatus } from '@pitchorium/contracts';

/**
 * What the registration block of an event shows (FRONT 7), from what the api gives the reader:
 * never a rule of its own (ADR 0113).
 */
export type RegistrationState =
  /** A visitor: sign in to register. */
  | 'sign_in'
  /** A seat is free: register. */
  | 'open'
  /** No seat left: join the waiting list. */
  | 'full'
  /** Registered: a seat is kept, withdraw possible. */
  | 'registered'
  /** On the waiting list at a position, withdraw possible. */
  | 'waitlisted'
  /** Started or over: registration closed. */
  | 'closed'
  | 'canceled'
  /** A draft, seen by its organizers only. */
  | 'draft';

export function registrationState(event: {
  status: EventStatus;
  startsAt: string;
  full: boolean;
  viewer: { registration: 'registered' | 'waitlisted' | null } | null;
  now?: number;
}): RegistrationState {
  if (event.status === 'draft') return 'draft';
  if (event.status === 'canceled') return 'canceled';
  const started = new Date(event.startsAt).getTime() <= (event.now ?? Date.now());
  if (event.viewer?.registration === 'registered') return started ? 'closed' : 'registered';
  if (event.viewer?.registration === 'waitlisted') return started ? 'closed' : 'waitlisted';
  if (event.status === 'completed' || started) return 'closed';
  if (!event.viewer) return 'sign_in';
  return event.full ? 'full' : 'open';
}

/** Seats left, or null for an unlimited event (no capacity). */
export function seatsLeft(capacity: number | null, registered: number): number | null {
  return capacity === null ? null : Math.max(0, capacity - registered);
}

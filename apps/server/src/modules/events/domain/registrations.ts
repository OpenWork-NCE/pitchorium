import type { EventRegistrationStatus } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

/**
 * Seats and waiting list (ADR 0070): a registration takes a seat while there is one, else joins
 * the waiting list; a freed seat goes to the first member of the list, in order of
 * registration. An unlimited event has no list.
 */
export function placeFor(
  capacity: number | null,
  registeredCount: number,
): EventRegistrationStatus {
  return capacity === null || registeredCount < capacity ? 'registered' : 'waitlisted';
}

/** Members of the waiting list to promote, in its order, for the free seats. */
export function promotions(
  capacity: number | null,
  registeredCount: number,
  waitlist: readonly string[],
): string[] {
  const free = capacity === null ? waitlist.length : Math.max(0, capacity - registeredCount);
  return waitlist.slice(0, free);
}

/** The capacity never drops below the members already registered. */
export function assertCapacity(capacity: number | null, registeredCount: number): void {
  if (capacity !== null && capacity < registeredCount) {
    throw new DomainError(
      'EVENTS_CAPACITY_BELOW_REGISTERED',
      'The capacity is below the registered members',
    );
  }
}

export function isFull(capacity: number | null, registeredCount: number): boolean {
  return capacity !== null && registeredCount >= capacity;
}

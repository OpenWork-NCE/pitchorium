import { Injectable } from '@nestjs/common';
import type { EventRegistration } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError } from '../../../platform/kernel';
import { type EventRecord, isRegistrationOpen } from '../domain/event';
import { RegistrationCanceled, RegistrationCreated } from '../domain/event-events';
import { placeFor } from '../domain/registrations';
import { EventEventsRecorder } from './event-events.recorder';
import { EventsService } from './events.service';
import { EventsRepository, type RegistrationRecord } from './ports';

/**
 * Free registration (ADR 0070): a seat while there is one, else the waiting list; withdrawing
 * frees the seat for the first member of the list. Writes are serialized on the event row.
 */
@Injectable()
export class RegistrationsService {
  constructor(
    private readonly events: EventsRepository,
    private readonly writes: EventsService,
    private readonly recorder: EventEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  /** Idempotent: registering again only changes the consent to be shown to the attendees. */
  async register(
    eventId: string,
    userId: string,
    showInAttendees: boolean,
  ): Promise<EventRegistration> {
    return this.transactions.run(async () => {
      const event = await this.require(eventId);
      const now = this.clock.now();
      const existing = await this.events.findRegistration(eventId, userId);
      if (existing) {
        if (existing.showInAttendees !== showInAttendees) {
          await this.events.setShowInAttendees(eventId, userId, showInAttendees);
        }
        return this.view({ ...existing, showInAttendees });
      }
      if (!isRegistrationOpen(event, now)) {
        throw new DomainError('EVENTS_REGISTRATION_CLOSED', 'Registrations are closed');
      }
      const status = placeFor(event.capacity, event.registeredCount);
      const registration: RegistrationRecord = {
        eventId,
        userId,
        status,
        showInAttendees,
        registeredAt: now,
        promotedAt: null,
      };
      await this.events.insertRegistration(registration);
      await this.events.updateEvent(
        eventId,
        status === 'registered'
          ? { registeredCount: event.registeredCount + 1 }
          : { waitlistCount: event.waitlistCount + 1 },
      );
      await this.recorder.record(RegistrationCreated, eventId, { userId, status });
      return this.view(registration);
    });
  }

  /** A freed seat goes to the waiting list at once. */
  async withdraw(eventId: string, userId: string): Promise<void> {
    await this.transactions.run(async () => {
      const event = await this.require(eventId);
      const registration = await this.events.findRegistration(eventId, userId);
      if (!registration) {
        throw new DomainError('EVENTS_NOT_REGISTERED', 'No registration to this event');
      }
      if (event.status !== 'published') {
        throw new DomainError('EVENTS_REGISTRATION_CLOSED', 'The event is no longer open');
      }
      await this.events.deleteRegistration(eventId, userId);
      const remaining: EventRecord =
        registration.status === 'registered'
          ? { ...event, registeredCount: event.registeredCount - 1 }
          : { ...event, waitlistCount: event.waitlistCount - 1 };
      await this.events.updateEvent(eventId, {
        registeredCount: remaining.registeredCount,
        waitlistCount: remaining.waitlistCount,
      });
      await this.recorder.record(RegistrationCanceled, eventId, {
        userId,
        status: registration.status,
      });
      if (registration.status === 'registered') {
        await this.writes.promoteWaitlist(remaining, this.clock.now());
      }
    });
  }

  private async view(registration: RegistrationRecord): Promise<EventRegistration> {
    return {
      eventId: registration.eventId,
      status: registration.status,
      waitlistPosition:
        registration.status === 'waitlisted'
          ? await this.events.waitlistPosition(registration.eventId, registration.userId)
          : null,
      showInAttendees: registration.showInAttendees,
      registeredAt: registration.registeredAt.toISOString(),
    };
  }

  private async require(eventId: string): Promise<EventRecord> {
    const event = await this.events.lockEvent(eventId);
    if (!event || event.deletedAt) throw new DomainError('EVENTS_NOT_FOUND', 'Event not found');
    return event;
  }
}

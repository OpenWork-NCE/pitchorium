import { Injectable, type OnModuleInit } from '@nestjs/common';
import { and, eq, inArray } from '@pitchorium/db/orm';
import {
  eventsCalendarTokens,
  eventsEvents,
  eventsRegistrations,
} from '@pitchorium/db/schemas/events';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';
import { EventsService } from '../application/events.service';
import { RegistrationsService } from '../application/registrations.service';

/**
 * Personal data of events: events organized, registrations, calendar feed. The erasure frees
 * the seats (the waiting list moves up), cancels the upcoming events the member organizes
 * (attendees are told), deletes their drafts and keeps past events under the pseudonym.
 */
@Injectable()
export class EventsPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly writes: EventsService,
    private readonly registrations: RegistrationsService,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'events',
      description:
        'The events you organize, your registrations (with your choice to be shown among the attendees) and your personal calendar feed.',
      order: ERASURE_ORDER.contents,
      exporter: {
        export: async (userId) => ({
          data: {
            organized: await this.db
              .select()
              .from(eventsEvents)
              .where(eq(eventsEvents.organizerId, userId)),
            registrations: await this.db
              .select()
              .from(eventsRegistrations)
              .where(eq(eventsRegistrations.userId, userId)),
            calendarFeed: await this.db
              .select({ createdAt: eventsCalendarTokens.createdAt })
              .from(eventsCalendarTokens)
              .where(eq(eventsCalendarTokens.userId, userId)),
          },
        }),
      },
      eraser: { erase: ({ userId, pseudonym }) => this.erase(userId, pseudonym) },
    });
  }

  private async erase(userId: string, pseudonym: string): Promise<void> {
    const db = this.db;
    const registered = await db
      .select({ eventId: eventsRegistrations.eventId, status: eventsEvents.status })
      .from(eventsRegistrations)
      .innerJoin(eventsEvents, eq(eventsEvents.id, eventsRegistrations.eventId))
      .where(eq(eventsRegistrations.userId, userId));
    for (const registration of registered) {
      if (registration.status === 'published') {
        await this.registrations.withdraw(registration.eventId, userId);
      }
    }
    await db.delete(eventsRegistrations).where(eq(eventsRegistrations.userId, userId));
    const now = this.clock.now();
    const organized = await db
      .select()
      .from(eventsEvents)
      .where(
        and(
          eq(eventsEvents.organizerId, userId),
          inArray(eventsEvents.status, ['draft', 'published']),
        ),
      );
    for (const event of organized) {
      if (event.deletedAt) continue;
      if (event.status === 'draft') await this.writes.delete(event.id);
      else if (event.startsAt > now) await this.writes.cancel(event.id, pseudonym, null);
    }
    await db.delete(eventsCalendarTokens).where(eq(eventsCalendarTokens.userId, userId));
    await replaceIdentifier(
      db,
      [{ table: 'events.events', column: 'organizer_id' }],
      userId,
      pseudonym,
    );
  }
}

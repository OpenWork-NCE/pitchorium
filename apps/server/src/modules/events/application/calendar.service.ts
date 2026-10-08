import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { CalendarFeed } from '@pitchorium/contracts';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { Clock, DomainError } from '../../../platform/kernel';
import type { EventRecord } from '../domain/event';
import { calendar, type IcsEvent } from '../domain/ics';
import { EventsRepository } from './ports';

const DAY_MS = 86_400_000;
/** Past events kept in a personal calendar. */
const CALENDAR_PAST_DAYS = 30;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * iCalendar exports (RFC 5545): one event, and the personal calendar of the events a member
 * registered to, reached by a secret token (only its hash is stored) that the member revokes or
 * replaces. The connection link appears only for those allowed to see it.
 */
@Injectable()
export class CalendarService {
  constructor(
    private readonly events: EventsRepository,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
    private readonly clock: Clock,
  ) {}

  eventCalendar(event: EventRecord, revealLink: boolean): string {
    return calendar(event.title, [this.icsEvent(event, revealLink)], this.clock.now());
  }

  /** Creates or replaces the token: the previous URL stops working. */
  async rotate(userId: string): Promise<CalendarFeed> {
    const token = randomBytes(32).toString('base64url');
    const now = this.clock.now();
    await this.events.setCalendarToken(userId, hash(token), now);
    return { url: this.feedUrl(token), createdAt: now.toISOString() };
  }

  /** Whether a calendar exists; the URL itself is shown only when created. */
  async createdAt(userId: string): Promise<Date | null> {
    return this.events.calendarTokenCreatedAt(userId);
  }

  async revoke(userId: string): Promise<void> {
    if (!(await this.events.deleteCalendarToken(userId))) {
      throw new DomainError('EVENTS_CALENDAR_NOT_FOUND', 'Calendar not found');
    }
  }

  /** The member's registered events, canceled ones included so that calendars drop them. */
  async feed(token: string): Promise<string> {
    const userId = await this.events.userIdByCalendarToken(hash(token));
    if (!userId) throw new DomainError('EVENTS_CALENDAR_NOT_FOUND', 'Calendar not found');
    const now = this.clock.now();
    const events = await this.events.calendarEvents(
      userId,
      new Date(now.getTime() - CALENDAR_PAST_DAYS * DAY_MS),
    );
    return calendar(
      'Pitchorium',
      events.map((event) => this.icsEvent(event, true)),
      now,
    );
  }

  private icsEvent(event: EventRecord, revealLink: boolean): IcsEvent {
    const place = event.location
      ? [event.location.name, event.location.address, event.location.city]
          .filter((part) => part)
          .join(', ')
      : null;
    const link = revealLink && event.onlineUrl ? `\n\n${event.onlineUrl}` : '';
    return {
      uid: `${event.id}@pitchorium`,
      sequence: event.sequence,
      title: event.title,
      description: `${event.description}${link}`,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      timeZone: event.timeZone,
      location: place ?? (revealLink ? event.onlineUrl : null),
      url: `${this.config.webAppUrl}/events/${event.slug}`,
      canceled: event.status === 'canceled',
      updatedAt: event.updatedAt,
    };
  }

  private feedUrl(token: string): string {
    return `${this.config.apiPublicUrl}/v1/calendars/${token}.ics`;
  }
}

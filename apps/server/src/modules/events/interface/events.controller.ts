import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiMovedPermanentlyResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import {
  type CalendarFeed,
  calendarFeedSchema,
  calendarTokenParamsSchema,
  cancelEventRequestSchema,
  changeEventSlugRequestSchema,
  createEventRequestSchema,
  type CursorPage,
  cursorPageQuerySchema,
  type EventAttendee,
  eventAttendeePageSchema,
  type EventCard,
  eventCardPageSchema,
  eventIdParamsSchema,
  eventListQuerySchema,
  type EventRegistration,
  eventRegistrationSchema,
  eventSchema,
  eventSlugParamsSchema,
  type EventView,
  myEventsQuerySchema,
  registerToEventRequestSchema,
  updateEventRequestSchema,
} from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { DomainError } from '../../../platform/kernel';
import { CalendarService } from '../application/calendar.service';
import { type EventLookup, EventReadsService } from '../application/event-reads.service';
import { EventsService } from '../application/events.service';
import { EventsRepository } from '../application/ports';
import { RegistrationsService } from '../application/registrations.service';
import { EventResolver } from './event.resolver';

class EventDto extends createZodDto(eventSchema) {}
class EventCardPageDto extends createZodDto(eventCardPageSchema) {}
class EventAttendeePageDto extends createZodDto(eventAttendeePageSchema) {}
class EventRegistrationDto extends createZodDto(eventRegistrationSchema) {}
class CalendarFeedDto extends createZodDto(calendarFeedSchema) {}
class CreateEventDto extends createZodDto(createEventRequestSchema) {}
class UpdateEventDto extends createZodDto(updateEventRequestSchema) {}
class ChangeEventSlugDto extends createZodDto(changeEventSlugRequestSchema) {}
class CancelEventDto extends createZodDto(cancelEventRequestSchema) {}
class RegisterDto extends createZodDto(registerToEventRequestSchema) {}
class EventListQueryDto extends createZodDto(eventListQuerySchema) {}
class MyEventsQueryDto extends createZodDto(myEventsQuerySchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}
class EventIdParamsDto extends createZodDto(eventIdParamsSchema) {}
class EventSlugParamsDto extends createZodDto(eventSlugParamsSchema) {}
class CalendarTokenParamsDto extends createZodDto(calendarTokenParamsSchema) {}

/** Short shared cache: a change of the page, or its withdrawal, must show quickly. */
const PUBLIC_EVENT_CACHE = 'public, max-age=60';

function reply(response: Response, lookup: EventLookup, basePath: string): void {
  if (lookup.kind === 'missing') throw new DomainError('EVENTS_NOT_FOUND', 'Event not found');
  if (lookup.kind === 'moved') {
    response.redirect(HttpStatus.MOVED_PERMANENTLY, `${basePath}/${lookup.slug}`);
    return;
  }
  response.json(eventSchema.parse(lookup.view));
}

function sendCalendar(response: Response, name: string, ics: string, cache: string): void {
  response
    .status(HttpStatus.OK)
    .setHeader('Content-Type', 'text/calendar; charset=utf-8')
    .setHeader('Content-Disposition', `attachment; filename="${name}.ics"`)
    .setHeader('Cache-Control', cache)
    .send(ics);
}

/**
 * Events (§14, scope to validate, ADR 0069 and 0070): free events of members and
 * organizations, registration with waiting list, calendar exports.
 */
@ApiTags('events')
@Controller()
export class EventsController {
  constructor(
    private readonly writes: EventsService,
    private readonly reads: EventReadsService,
    private readonly registrations: RegistrationsService,
    private readonly calendars: CalendarService,
    private readonly events: EventsRepository,
  ) {}

  @Post('events')
  @RequireAction('event.create')
  @Idempotent()
  @ZodSerializerDto(EventDto)
  @ApiCreatedResponse({ type: EventDto.Output })
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreateEventDto,
  ): Promise<EventView> {
    const event = await this.writes.create(principal.userId, body);
    return this.reads.view(event, { kind: 'member', viewerId: principal.userId });
  }

  /** Upcoming and ongoing published events, the soonest end first, with filters. */
  @Get('events')
  @RequireAction('event.read')
  @ZodSerializerDto(EventCardPageDto)
  @ApiOkResponse({ type: EventCardPageDto.Output })
  list(
    @CurrentPrincipal() principal: Principal,
    @Query() query: EventListQueryDto,
  ): Promise<CursorPage<EventCard>> {
    return this.reads.list(query, { kind: 'member', viewerId: principal.userId });
  }

  @Get('public/events')
  @Public()
  @ZodSerializerDto(EventCardPageDto)
  @ApiOkResponse({ type: EventCardPageDto.Output })
  async publicList(
    @Query() query: EventListQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CursorPage<EventCard>> {
    const page = await this.reads.list(query, { kind: 'public' });
    response.setHeader('Cache-Control', PUBLIC_EVENT_CACHE);
    return page;
  }

  /** Events the member organizes (drafts included) or attends (seat or waiting list). */
  @Get('me/events')
  @RequireAction('event.read')
  @ZodSerializerDto(EventCardPageDto)
  @ApiOkResponse({ type: EventCardPageDto.Output })
  mine(
    @CurrentPrincipal() principal: Principal,
    @Query() query: MyEventsQueryDto,
  ): Promise<CursorPage<EventCard>> {
    return this.reads.mine(principal.userId, query.role, query);
  }

  @Get('events/by-slug/:slug')
  @RequireAction('event.read')
  @ApiOkResponse({ type: EventDto.Output })
  @ApiMovedPermanentlyResponse({ description: 'Former slug: Location gives the current one.' })
  async bySlug(
    @CurrentPrincipal() principal: Principal,
    @Param() params: EventSlugParamsDto,
    @Res() response: Response,
  ): Promise<void> {
    const lookup = await this.reads.bySlug(params.slug, {
      kind: 'member',
      viewerId: principal.userId,
    });
    reply(response, lookup, '/v1/events/by-slug');
  }

  /** Public page of a public event, without session; cacheable by shared caches. */
  @Get('public/events/:slug')
  @Public()
  @ApiOkResponse({ type: EventDto.Output })
  @ApiMovedPermanentlyResponse({ description: 'Former slug: Location gives the current one.' })
  async forPublic(@Param() params: EventSlugParamsDto, @Res() response: Response): Promise<void> {
    const lookup = await this.reads.bySlug(params.slug, { kind: 'public' });
    response.setHeader('Cache-Control', PUBLIC_EVENT_CACHE);
    reply(response, lookup, '/v1/public/events');
  }

  /** iCalendar file of a public event, without the connection link. */
  @Get('public/events/:slug/ics')
  @Public()
  @ApiProduces('text/calendar')
  @ApiOkResponse({ description: 'iCalendar file (RFC 5545)', schema: { type: 'string' } })
  async publicIcs(@Param() params: EventSlugParamsDto, @Res() response: Response): Promise<void> {
    const resolved = await this.events.resolveSlug(params.slug);
    const event = resolved ? await this.events.findEvent(resolved.eventId) : null;
    if (!event || !(await this.reads.canSee(event, { kind: 'public' }))) {
      throw new DomainError('EVENTS_NOT_FOUND', 'Event not found');
    }
    sendCalendar(
      response,
      event.slug,
      this.calendars.eventCalendar(event, false),
      PUBLIC_EVENT_CACHE,
    );
  }

  @Get('events/:eventId')
  @RequireAction('event.read', { resource: EventResolver })
  @ZodSerializerDto(EventDto)
  @ApiOkResponse({ type: EventDto.Output })
  async byId(
    @CurrentPrincipal() principal: Principal,
    @Param() params: EventIdParamsDto,
  ): Promise<EventView> {
    return this.view(params.eventId, principal.userId);
  }

  /** iCalendar file; the connection link only for a registered member or the organizer. */
  @Get('events/:eventId/ics')
  @RequireAction('event.read', { resource: EventResolver })
  @ApiProduces('text/calendar')
  @ApiOkResponse({ description: 'iCalendar file (RFC 5545)', schema: { type: 'string' } })
  async ics(
    @CurrentPrincipal() principal: Principal,
    @Param() params: EventIdParamsDto,
    @Res() response: Response,
  ): Promise<void> {
    const event = await this.require(params.eventId);
    const [manager, registration] = await Promise.all([
      this.reads.canManage(event, principal.userId),
      this.events.findRegistration(event.id, principal.userId),
    ]);
    const reveal = manager || registration?.status === 'registered';
    sendCalendar(
      response,
      event.slug,
      this.calendars.eventCalendar(event, reveal),
      'private, no-store',
    );
  }

  @Patch('events/:eventId')
  @RequireAction('event.update', { resource: EventResolver })
  @ZodSerializerDto(EventDto)
  @ApiOkResponse({ type: EventDto.Output })
  async update(
    @CurrentPrincipal() principal: Principal,
    @Param() params: EventIdParamsDto,
    @Body() body: UpdateEventDto,
  ): Promise<EventView> {
    await this.writes.update(params.eventId, principal.userId, body);
    return this.view(params.eventId, principal.userId);
  }

  @Put('events/:eventId/slug')
  @RequireAction('event.update', { resource: EventResolver })
  @ZodSerializerDto(EventDto)
  @ApiOkResponse({ type: EventDto.Output })
  async changeSlug(
    @CurrentPrincipal() principal: Principal,
    @Param() params: EventIdParamsDto,
    @Body() body: ChangeEventSlugDto,
  ): Promise<EventView> {
    await this.writes.changeSlug(params.eventId, body.slug);
    return this.view(params.eventId, principal.userId);
  }

  @Post('events/:eventId/publish')
  @RequireAction('event.publish', { resource: EventResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(EventDto)
  @ApiOkResponse({ type: EventDto.Output })
  async publish(
    @CurrentPrincipal() principal: Principal,
    @Param() params: EventIdParamsDto,
  ): Promise<EventView> {
    await this.writes.publish(params.eventId);
    return this.view(params.eventId, principal.userId);
  }

  /** The registered members and the waiting list are notified. */
  @Post('events/:eventId/cancel')
  @RequireAction('event.cancel', { resource: EventResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(EventDto)
  @ApiOkResponse({ type: EventDto.Output })
  async cancel(
    @CurrentPrincipal() principal: Principal,
    @Param() params: EventIdParamsDto,
    @Body() body: CancelEventDto,
  ): Promise<EventView> {
    await this.writes.cancel(params.eventId, principal.userId, body.reason);
    return this.view(params.eventId, principal.userId);
  }

  @Delete('events/:eventId')
  @RequireAction('event.delete', { resource: EventResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async delete(@Param() params: EventIdParamsDto): Promise<void> {
    await this.writes.delete(params.eventId);
  }

  /** A seat, else the waiting list; again, it only changes the consent to be shown. */
  @Put('events/:eventId/registration')
  @RequireAction('event.register', { resource: EventResolver })
  @ZodSerializerDto(EventRegistrationDto)
  @ApiOkResponse({ type: EventRegistrationDto.Output })
  register(
    @CurrentPrincipal() principal: Principal,
    @Param() params: EventIdParamsDto,
    @Body() body: RegisterDto,
  ): Promise<EventRegistration> {
    return this.registrations.register(params.eventId, principal.userId, body.showInAttendees);
  }

  /** Withdrawal; a freed seat goes to the first member of the waiting list. */
  @Delete('events/:eventId/registration')
  @RequireAction('event.register', { resource: EventResolver })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async withdraw(
    @CurrentPrincipal() principal: Principal,
    @Param() params: EventIdParamsDto,
  ): Promise<void> {
    await this.registrations.withdraw(params.eventId, principal.userId);
  }

  /** Every registration for the organizer; consenting registered members for an attendee. */
  @Get('events/:eventId/attendees')
  @RequireAction('event.attendees.read', { resource: EventResolver })
  @ZodSerializerDto(EventAttendeePageDto)
  @ApiOkResponse({ type: EventAttendeePageDto.Output })
  async attendees(
    @CurrentPrincipal() principal: Principal,
    @Param() params: EventIdParamsDto,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<EventAttendee>> {
    return this.reads.attendees(await this.require(params.eventId), principal.userId, query);
  }

  /** Creates or replaces the secret URL of the personal calendar (the previous one stops). */
  @Post('me/event-calendar')
  @RequireAction('event.calendar.manage')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(CalendarFeedDto)
  @ApiOkResponse({ type: CalendarFeedDto.Output })
  rotateCalendar(@CurrentPrincipal() principal: Principal): Promise<CalendarFeed> {
    return this.calendars.rotate(principal.userId);
  }

  @Delete('me/event-calendar')
  @RequireAction('event.calendar.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async revokeCalendar(@CurrentPrincipal() principal: Principal): Promise<void> {
    await this.calendars.revoke(principal.userId);
  }

  /** Personal calendar: the secret token in the URL is the only credential. */
  @Get('calendars/:token')
  @Public()
  @ApiProduces('text/calendar')
  @ApiOkResponse({ description: 'iCalendar feed (RFC 5545)', schema: { type: 'string' } })
  async calendar(
    @Param() params: CalendarTokenParamsDto,
    @Res() response: Response,
  ): Promise<void> {
    const token = params.token.slice(0, -'.ics'.length);
    sendCalendar(response, 'pitchorium', await this.calendars.feed(token), 'private, no-store');
  }

  private async view(eventId: string, viewerId: string): Promise<EventView> {
    const view = await this.reads.byId(eventId, { kind: 'member', viewerId });
    if (!view) throw new DomainError('EVENTS_NOT_FOUND', 'Event not found');
    return view;
  }

  private async require(eventId: string) {
    const event = await this.events.findEvent(eventId);
    if (!event) throw new DomainError('EVENTS_NOT_FOUND', 'Event not found');
    return event;
  }
}

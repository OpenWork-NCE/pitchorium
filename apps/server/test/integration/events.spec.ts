import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import type { EventView, FeedPage } from '@pitchorium/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventsMaintenanceService } from '../../src/modules/events/application/events-maintenance.service';
import { NotificationsMaintenanceService } from '../../src/modules/notifications/application/notifications-maintenance.service';
import { OutboxRelayService } from '../../src/platform/outbox';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { TEST_API_URL } from './support/environment';
import { createFullWorker, notificationOf } from './support/full-worker';
import { createMember, type Member } from './support/members';
import { handleOf } from './support/messaging';

const HOUR = 3_600_000;

/** Free events (ADR 0069, 0070): registration, waiting list, link, reminder, calendar. */
describe('events', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  let ama: Member;
  let kofi: Member;
  let awa: Member;

  beforeAll(async () => {
    ({ app } = await createApiTestApp());
    worker = await createFullWorker();
  });

  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
    ama = await createMember(app, 'ama@example.com', { name: 'Ama Owusu' });
    kofi = await createMember(app, 'kofi@example.com', { name: 'Kofi Mensah' });
    awa = await createMember(app, 'awa@example.com', { name: 'Awa Ndiaye' });
    for (const member of [ama, kofi, awa]) await handleOf(member);
  });

  const createEvent = async (organizer: Member, overrides: Record<string, unknown> = {}) => {
    const start = Date.now() + 2 * HOUR;
    const created = await organizer.agent
      .post('/v1/events')
      .set('Idempotency-Key', randomUUID())
      .send({
        title: 'Forum de l’agriculture durable',
        description: '## Programme\n\nDes **ateliers** et un [site](https://example.org).',
        format: 'hybrid',
        startsAt: new Date(start).toISOString().replace('Z', '+00:00'),
        endsAt: new Date(start + 2 * HOUR).toISOString(),
        timeZone: 'Africa/Dakar',
        location: { name: 'Impact Hub', address: null, city: 'Dakar', countryCode: 'SN' },
        onlineUrl: 'https://meet.example.org/forum',
        language: 'fr',
        sectorCodes: ['agriculture_forestry_fishing'],
        capacity: 1,
        visibility: 'members',
        ...overrides,
      });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    return created.body as EventView;
  };

  it('fills a seat, queues the next member, reveals the link to the registered and promotes on withdrawal', async () => {
    const draft = await createEvent(ama);
    expect(draft).toMatchObject({ status: 'draft', countryCodes: ['SN'], registeredCount: 0 });
    // A draft is invisible to the others; publication opens it.
    await kofi.agent.get(`/v1/events/${draft.id}`).expect(404);
    const published = await ama.agent.post(`/v1/events/${draft.id}/publish`).expect(200);
    expect(published.body).toMatchObject({ status: 'published', viewer: { canManage: true } });

    const kofiSeat = await kofi.agent
      .put(`/v1/events/${draft.id}/registration`)
      .send({ showInAttendees: true })
      .expect(200);
    expect(kofiSeat.body).toMatchObject({ status: 'registered', waitlistPosition: null });
    const awaSeat = await awa.agent.put(`/v1/events/${draft.id}/registration`).send({}).expect(200);
    expect(awaSeat.body).toMatchObject({ status: 'waitlisted', waitlistPosition: 1 });

    // The connection link is for the registered members and the organizer only.
    const asKofi = (await kofi.agent.get(`/v1/events/${draft.id}`).expect(200)).body as EventView;
    const asAwa = (await awa.agent.get(`/v1/events/${draft.id}`).expect(200)).body as EventView;
    expect(asKofi).toMatchObject({ onlineUrl: 'https://meet.example.org/forum', full: true });
    expect(asAwa).toMatchObject({ onlineUrl: null, waitlistCount: 1 });
    expect(asAwa.viewer).toMatchObject({ registration: 'waitlisted', waitlistPosition: 1 });

    // Attendees: everything for the organizer, consenting registered members for an attendee.
    const forOrganizer = await ama.agent.get(`/v1/events/${draft.id}/attendees`).expect(200);
    const statuses = (forOrganizer.body as { items: { status: string }[] }).items.map(
      (item) => item.status,
    );
    expect(statuses).toEqual(['registered', 'waitlisted']);
    const forAttendee = await kofi.agent.get(`/v1/events/${draft.id}/attendees`).expect(200);
    expect(forAttendee.body.items).toHaveLength(1);
    await awa.agent.get(`/v1/events/${draft.id}/attendees`).expect(403);

    expect(await notificationOf(worker, awa, 'event_registration_confirmed')).toMatchObject({
      data: { waitlisted: true },
      target: { type: 'event', key: draft.slug },
    });

    // Kofi withdraws: Awa takes the seat at once and is told.
    await kofi.agent.delete(`/v1/events/${draft.id}/registration`).expect(204);
    const promoted = (await awa.agent.get(`/v1/events/${draft.id}`).expect(200)).body as EventView;
    expect(promoted).toMatchObject({
      onlineUrl: 'https://meet.example.org/forum',
      registeredCount: 1,
      waitlistCount: 0,
      viewer: { registration: 'registered' },
    });
    await notificationOf(worker, awa, 'event_waitlist_promoted');

    // Reminder before the start, once per registered member.
    const maintenance = worker.get(NotificationsMaintenanceService);
    expect(await maintenance.eventReminders()).toBe(1);
    expect(await maintenance.eventReminders()).toBe(0);
    await notificationOf(worker, awa, 'event_reminder');

    // A full capacity cannot drop below the registered members.
    const lower = await ama.agent
      .patch(`/v1/events/${draft.id}`)
      .send({ capacity: null })
      .expect(200);
    expect(lower.body).toMatchObject({ capacity: null, full: false });
  });

  it('exports calendars, revokes the personal feed and drops a canceled event from calendars', async () => {
    const event = await createEvent(ama, { capacity: null });
    await ama.agent.post(`/v1/events/${event.id}/publish`).expect(200);
    await awa.agent.put(`/v1/events/${event.id}/registration`).send({}).expect(200);

    const single = await awa.agent.get(`/v1/events/${event.id}/ics`).expect(200);
    expect(single.headers['content-type']).toContain('text/calendar');
    expect(single.text).toContain(`UID:${event.id}@pitchorium`);
    expect(single.text).toContain('https://meet.example.org/forum');
    const notRegistered = await kofi.agent.get(`/v1/events/${event.id}/ics`).expect(200);
    expect(notRegistered.text).not.toContain('https://meet.example.org/forum');

    const feed = await awa.agent.post('/v1/me/event-calendar').expect(200);
    const path = (feed.body.url as string).replace(TEST_API_URL, '');
    expect(path).toMatch(/^\/v1\/calendars\/[A-Za-z0-9_-]{43}\.ics$/);
    const calendar = await kofi.agent.get(path).expect(200);
    expect(calendar.text).toContain('SUMMARY:Forum de l’agriculture durable');
    expect(calendar.text).toContain('STATUS:CONFIRMED');

    // Cancellation: the attendees are notified and calendars drop the event.
    await ama.agent
      .post(`/v1/events/${event.id}/cancel`)
      .send({ reason: 'Intempéries' })
      .expect(200);
    await notificationOf(worker, awa, 'event_canceled');
    expect((await kofi.agent.get(path).expect(200)).text).toContain('STATUS:CANCELLED');

    // A new URL replaces the previous one; revocation closes it.
    const rotated = await awa.agent.post('/v1/me/event-calendar').expect(200);
    await kofi.agent.get(path).expect(404);
    await awa.agent.delete('/v1/me/event-calendar').expect(204);
    await kofi.agent.get((rotated.body.url as string).replace(TEST_API_URL, '')).expect(404);
  });

  it('applies the visibility of publications, blocks, the feed of the followers and completion', async () => {
    // A public event needs a public organizer.
    const hidden = await createEvent(ama, { visibility: 'public' });
    const refused = await ama.agent.post(`/v1/events/${hidden.id}/publish`).expect(422);
    expect(refused.body.code).toBe('EVENTS_PUBLIC_NOT_ALLOWED');
    await ama.agent
      .patch('/v1/me/profile/visibility')
      .send({ publicPageEnabled: true })
      .expect(200);
    await ama.agent.post(`/v1/events/${hidden.id}/publish`).expect(200);
    const page = await request(app.getHttpServer())
      .get(`/v1/public/events/${hidden.slug}`)
      .expect(200);
    expect(page.headers['cache-control']).toBe('public, max-age=60');
    expect(page.body).toMatchObject({ onlineUrl: null, viewer: null, visibility: 'public' });
    const ics = await request(app.getHttpServer())
      .get(`/v1/public/events/${hidden.slug}/ics`)
      .expect(200);
    expect(ics.text).not.toContain('meet.example.org');

    // The followers of the organizer see it in their feed.
    await kofi.agent.put(`/v1/network/follows/member/${await handleOf(ama)}`).expect(200);
    const feed = (await kofi.agent.get('/v1/feed').expect(200)).body as FeedPage;
    expect(feed.items).toContainEqual(
      expect.objectContaining({ type: 'event', id: `event:${hidden.id}` }),
    );

    // Across a block, the event does not exist.
    await awa.agent.put(`/v1/network/blocks/${await handleOf(ama)}`).expect(204);
    await awa.agent.get(`/v1/events/${hidden.id}`).expect(404);
    const list = await awa.agent.get('/v1/events').expect(200);
    expect(list.body.items).toEqual([]);

    // Completed by the scheduled task once over.
    await query(
      `UPDATE events.events SET starts_at = now() - interval '3 hours', ends_at = now() - interval '1 hour' WHERE id = $1`,
      [hidden.id],
    );
    expect(await worker.get(EventsMaintenanceService).completeEnded()).toBe(1);
    const completed = await ama.agent.get(`/v1/events/${hidden.id}`).expect(200);
    expect(completed.body.status).toBe('completed');
    await vi.waitFor(async () => {
      await worker.get(OutboxRelayService).relayBatch();
      const [row] = await query<{ count: string }>(
        `SELECT count(*) FROM platform.outbox_events WHERE event_type = 'events.event.completed.v1'`,
      );
      expect(Number(row?.count)).toBe(1);
    });
  });
});

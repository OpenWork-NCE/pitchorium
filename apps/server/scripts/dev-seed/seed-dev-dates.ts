import type { INestApplicationContext } from '@nestjs/common';
import type { Database } from '@pitchorium/db';
import { sql, type SQL } from '@pitchorium/db/orm';
import { PrivacyRequestsService } from '../../src/modules/privacy/application/privacy-requests.service';
import { slugBaseFromTitle as eventSlugBase } from '../../src/modules/events/domain/event';
import { slugBaseFromTitle as projectSlugBase } from '../../src/modules/projects/domain/project';
import { DEMO_PENDING_REQUESTS } from './dataset';
import { DEMO_PROJECTS } from './projects-dataset';
import { dayAfter, DEMO_EVENTS, DEMO_MISSIONS } from './seed-dev-discovery';
import { demoId } from './seed-dev-data';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
/** A state already within a minute of its place is left as it is (the first run). */
const TOLERANCE_MS = 60_000;

/** Dated states set again by this run. */
export interface DevDatesResult {
  suspensions: number;
  erasures: number;
  exports: number;
  campaigns: number;
  events: number;
  missions: number;
  invitations: number;
}

const userId = (key: string) => demoId(`member:${key}`);

/** `column + delta`, the delta in milliseconds. */
const shifted = (column: string, deltaMs: number): SQL =>
  sql`${sql.raw(column)} + make_interval(secs => ${deltaMs / 1000}::double precision)`;

/**
 * The dated states of the demonstration, set again relative to the date of this run (ADR 0170):
 * a run of `pnpm db:seed:dev` weeks after the first finds the suspension of Rodrigue Mbemba
 * still running, the erasure of Moussa Diarra in its grace period (its reminder not sent yet),
 * the export of Aïssatou Ba ready, the campaigns in funding with their days left, the upcoming
 * events ahead, the date a mission is wanted by ahead, and the pending invitations and
 * connection requests open. Every other row stays as the first run wrote it: nothing is
 * inserted here. Called before the services of the seed, so that their closing of the ended
 * campaigns and events applies to the new dates; the first run finds nothing to move.
 */
export async function shiftDatedStates(
  db: Database,
  now: Date,
  endingSoonMs: number,
): Promise<DevDatesResult> {
  const result: DevDatesResult = {
    suspensions: 0,
    erasures: 0,
    exports: 0,
    campaigns: 0,
    events: 0,
    missions: 0,
    invitations: 0,
  };
  const at = now.getTime();
  const delta = (target: number, current: Date) => target - current.getTime();
  const far = (ms: number) => Math.abs(ms) > TOLERANCE_MS;

  await db.transaction(async (tx) => {
    const run = (query: SQL) => tx.execute(query);

    // A suspension of fourteen days that started six hours before the run (seed-dev-trust.ts).
    const [suspension] = (
      await tx.execute<{
        id: string;
        decision_id: string;
        starts_at: Date;
        lifted_at: Date | null;
      }>(sql`select id, decision_id, starts_at, lifted_at from trust.suspensions
          where user_id = ${userId('rodrigue')} order by starts_at desc limit 1`)
    ).rows;
    if (suspension && !suspension.lifted_at) {
      const move = delta(at - 6 * HOUR_MS, new Date(suspension.starts_at));
      if (far(move)) {
        await run(sql`update trust.suspensions set starts_at = ${shifted('starts_at', move)},
          ends_at = ${shifted('ends_at', move)}, ended_at = null where id = ${suspension.id}`);
        await run(sql`update trust.decisions set decided_at = ${shifted('decided_at', move)},
          suspension_ends_at = ${shifted('suspension_ends_at', move)},
          appealable_until = ${shifted('appealable_until', move)}
          where id = ${suspension.decision_id} and reverted_at is null`);
        result.suspensions += 1;
      }
    }

    // An erasure requested at the run, in its grace period, its reminder still to come.
    const [erasure] = (
      await tx.execute<{
        id: string;
        requested_at: Date;
      }>(sql`select id, requested_at from privacy.erasures where user_id = ${userId('moussa')}
          and status in ('scheduled', 'blocked') limit 1`)
    ).rows;
    if (erasure) {
      const move = delta(at, new Date(erasure.requested_at));
      if (far(move)) {
        await run(sql`update privacy.erasures set requested_at = ${shifted('requested_at', move)},
          scheduled_for = ${shifted('scheduled_for', move)}, reminded_at = null
          where id = ${erasure.id}`);
        result.erasures += 1;
      }
    }

    // An export requested at the run: ready until its expiry, the next one possible tomorrow.
    const [archive] = (
      await tx.execute<{
        id: string;
        requested_at: Date;
      }>(sql`select id, requested_at from privacy.exports where user_id = ${userId('aissatou')}
          and status in ('pending', 'ready') and (expires_at is null or expires_at > ${now})
          order by requested_at desc limit 1`)
    ).rows;
    if (archive) {
      const move = delta(at, new Date(archive.requested_at));
      if (far(move)) {
        await run(sql`update privacy.exports set requested_at = ${shifted('requested_at', move)},
          completed_at = ${shifted('completed_at', move)}, expires_at = ${shifted('expires_at', move)}
          where id = ${archive.id}`);
        result.exports += 1;
      }
    }

    // Campaigns published `publishedDaysAgo` days before the run; one that should still run is
    // open again (the worker had closed it), the ended ones are closed by the seed afterwards.
    for (const demo of DEMO_PROJECTS) {
      if (demo.publishedDaysAgo === undefined) continue;
      const [project] = (
        await tx.execute<{
          id: string;
          published_at: Date;
          ends_at: Date | null;
          funded_at: Date | null;
        }>(sql`select id, published_at, ends_at, funded_at from projects.projects
            where slug = ${projectSlugBase(demo.title)} and published_at is not null`)
      ).rows;
      if (!project) continue;
      const move = delta(at - demo.publishedDaysAgo * DAY_MS, new Date(project.published_at));
      if (!far(move)) continue;
      const endsAt = project.ends_at ? new Date(project.ends_at).getTime() + move : null;
      const running = endsAt !== null && endsAt > at;
      await run(sql`update projects.projects set published_at = ${shifted('published_at', move)},
        ends_at = ${shifted('ends_at', move)},
        ending_soon_at = case when ${endsAt !== null && endsAt > at + endingSoonMs} then null
          else ending_soon_at end,
        status = case when status = 'closed' and ${running}
          then (case when funded_at is null then 'funding' else 'funded' end) else status end,
        closed_at = case when status = 'closed' and ${running} then null else closed_at end
        where id = ${project.id}`);
      result.campaigns += 1;
    }

    // Events `inDays` days from the run; an upcoming one completed by the worker is published.
    for (const demo of DEMO_EVENTS) {
      const [event] = (
        await tx.execute<{ id: string; starts_at: Date }>(
          sql`select id, starts_at from events.events where slug = ${eventSlugBase(demo.request.title)}`,
        )
      ).rows;
      if (!event) continue;
      const move = delta(at + demo.inDays * DAY_MS, new Date(event.starts_at));
      if (!far(move)) continue;
      const upcoming = demo.inDays > 0;
      await run(sql`update events.events set starts_at = ${shifted('starts_at', move)},
        ends_at = ${shifted('ends_at', move)},
        status = case when status = 'completed' and ${upcoming} then 'published' else status end,
        completed_at = case when status = 'completed' and ${upcoming} then null else completed_at end
        where id = ${event.id}`);
      result.events += 1;
    }

    for (const demo of DEMO_MISSIONS) {
      if (demo.desiredInDays === undefined) continue;
      const updated = await run(sql`update missions.missions
        set desired_by = ${dayAfter(now, demo.desiredInDays)}::date
        where author_id = ${userId(demo.author)} and title = ${demo.title}
          and desired_by is distinct from ${dayAfter(now, demo.desiredInDays)}::date`);
      result.missions += updated.rowCount ?? 0;
    }

    // Pending invitations of the organizations and connection requests, sent a day before the
    // run: open again until their expiry.
    for (const request of DEMO_PENDING_REQUESTS) {
      const id = demoId(`request:${request.from}:${request.to}`);
      const [pending] = (
        await tx.execute<{
          created_at: Date;
        }>(sql`select created_at from network.connection_requests where id = ${id}
            and status in ('pending', 'expired')`)
      ).rows;
      if (!pending) continue;
      const move = delta(at - DAY_MS, new Date(pending.created_at));
      if (!far(move)) continue;
      await run(sql`update network.connection_requests
        set created_at = ${shifted('created_at', move)}, expires_at = ${shifted('expires_at', move)},
          status = 'pending', responded_at = null
        where id = ${id}`);
      result.invitations += 1;
    }
    const invitations = (
      await tx.execute<{
        id: string;
        created_at: Date;
      }>(sql`select id, created_at from organizations.invitations
          where status in ('pending', 'expired')
            and invited_by in (${userId('thierry')}, ${userId('nadia')})`)
    ).rows;
    for (const invitation of invitations) {
      const move = delta(at - DAY_MS, new Date(invitation.created_at));
      if (!far(move)) continue;
      await run(sql`update organizations.invitations
        set created_at = ${shifted('created_at', move)}, expires_at = ${shifted('expires_at', move)},
          status = 'pending'
        where id = ${invitation.id}`);
      result.invitations += 1;
    }
  });
  return result;
}

/**
 * After the services of the seed: the erasure of Moussa Diarra and the export of Aïssatou Ba
 * requested again through the privacy module when the worker carried the first ones to their
 * end (an erasure executed, an archive expired). The first run finds those of the trust seed.
 */
export async function requestDatedStates(
  db: Database,
  context: INestApplicationContext,
): Promise<Pick<DevDatesResult, 'erasures' | 'exports'>> {
  const privacy = context.get(PrivacyRequestsService, { strict: false });
  const result = { erasures: 0, exports: 0 };
  const [moussa] = (
    await db.execute<{
      open: boolean;
      exists: boolean;
    }>(sql`select exists (select 1 from identity.users where id = ${userId('moussa')}) as exists,
        exists (select 1 from privacy.erasures where user_id = ${userId('moussa')}
          and status in ('scheduled', 'running', 'blocked')) as open`)
  ).rows;
  if (moussa?.exists && !moussa.open) {
    await privacy.requestErasure(userId('moussa'));
    result.erasures += 1;
  }
  const [aissatou] = (
    await db.execute<{
      usable: boolean;
    }>(sql`select exists (select 1 from privacy.exports where user_id = ${userId('aissatou')}
          and status in ('pending', 'ready')) as usable`)
  ).rows;
  if (aissatou && !aissatou.usable) {
    await privacy.requestExport(userId('aissatou'));
    result.exports += 1;
  }
  return result;
}

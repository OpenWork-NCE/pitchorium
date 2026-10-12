import type { BrowserContext } from '@playwright/test';
import pg from 'pg';

/**
 * The database of the run (scripts/e2e-live.sh, LIVE_DATABASE_URL), only to move a date into the
 * past: the end of a campaign, the end of the grace period of a deletion, the opening of a session
 * (a sensitive action then asks for a new sign-in). The worker then does the
 * real work at its next pass (SCHEDULED_TASKS_EVERY_MS). Nothing else is written here: every
 * other state goes through the api.
 */
export const DATABASE_URL = process.env.LIVE_DATABASE_URL ?? null;

async function run(statement: string, values: unknown[]): Promise<number> {
  const client = new pg.Client({ connectionString: DATABASE_URL! });
  await client.connect();
  try {
    return (await client.query(statement, values)).rowCount ?? 0;
  } finally {
    await client.end();
  }
}

/** The campaign of the project ended a minute ago: the worker closes it. */
export function endCampaign(projectId: string): Promise<number> {
  return run(`update projects.projects set ends_at = now() - interval '1 minute' where id = $1`, [
    projectId,
  ]);
}

/** The grace period of the scheduled deletion of the member is over: the worker erases. */
export function endGracePeriod(userId: string): Promise<number> {
  return run(
    `update privacy.erasures set scheduled_for = now() - interval '1 minute'
      where user_id = $1 and status = 'scheduled'`,
    [userId],
  );
}

/**
 * The session of this browser context was opened an hour ago: a sensitive action of the console
 * asks for a new sign-in (ACCESS_REAUTHENTICATION_REQUIRED). Only this session, by its token.
 */
export async function ageSession(context: BrowserContext): Promise<number> {
  const cookie = (await context.cookies()).find((item) => item.name.endsWith('session_token'));
  const token = decodeURIComponent(cookie?.value ?? '').split('.')[0];
  return run(
    `update identity.sessions set created_at = now() - interval '1 hour' where token = $1`,
    [token],
  );
}

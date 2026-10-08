import type { NestExpressApplication } from '@nestjs/platform-express';
import type { DatabaseHandle } from '@pitchorium/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PWNED_CHECK_UNAVAILABLE_METRIC } from '../../src/modules/identity/infrastructure/better-auth/better-auth.factory';
import { DATABASE_HANDLE } from '../../src/platform/database';
import { OpenTelemetryMetrics } from '../../src/platform/observability';
import { OutboxService } from '../../src/platform/outbox';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { TEST_WEB_APP_URL } from './support/environment';
import { browser, PASSWORD } from './support/members';
import { FakeOAuthProviders } from './support/oauth-providers';

const PWNED_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

function pause() {
  let arrive!: () => void;
  let release!: () => void;
  const reached = new Promise<void>((resolve) => (arrive = resolve));
  const released = new Promise<void>((resolve) => (release = resolve));
  return { reached, release, arrive, released };
}

/**
 * A slow external call must not hold a database connection: while the provider (OAuth token
 * exchange, Have I Been Pwned) has not answered, the api pool has no client checked out and no
 * session of the api is in a transaction.
 */
describe('auth transactions and external calls', () => {
  let app: NestExpressApplication;
  let handle: DatabaseHandle;
  const providers = new FakeOAuthProviders();
  let pwnedPause: ReturnType<typeof pause> | undefined;
  let pwnedFailure: 'http_error' | 'unreachable' | undefined;
  let fetchBeforePwned: typeof fetch;

  async function expectNoConnectionHeld(): Promise<void> {
    expect(handle.pool.totalCount - handle.pool.idleCount).toBe(0);
    const [busy] = await query<{ count: string }>(
      `SELECT count(*) FROM pg_stat_activity
       WHERE application_name = 'pitchorium-server' AND state <> 'idle'`,
    );
    expect(Number(busy?.count)).toBe(0);
  }

  beforeAll(async () => {
    await providers.start();
    // Have I Been Pwned answers "not compromised", after an optional pause.
    fetchBeforePwned = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (!url.startsWith(PWNED_RANGE_URL)) return fetchBeforePwned(input, init);
      if (pwnedFailure === 'unreachable') throw new TypeError('fetch failed');
      if (pwnedFailure === 'http_error') return new Response('busy', { status: 503 });
      const current = pwnedPause;
      pwnedPause = undefined;
      if (current) {
        current.arrive();
        await current.released;
      }
      return new Response('0000000000000000000000000000000000A:0\r\n', { status: 200 });
    };
    ({ app } = await createApiTestApp([], { AUTH_PWNED_PASSWORD_CHECK: 'true' }));
    handle = app.get<DatabaseHandle>(DATABASE_HANDLE);
  });

  afterAll(async () => {
    await app.close();
    globalThis.fetch = fetchBeforePwned;
    await providers.stop();
  });

  beforeEach(async () => {
    await truncateAllTables();
    vi.restoreAllMocks();
    pwnedFailure = undefined;
  });

  it('accepts the password when Have I Been Pwned fails, with a dedicated metric', async () => {
    const increment = vi.spyOn(OpenTelemetryMetrics.prototype, 'increment');
    for (const failure of ['http_error', 'unreachable'] as const) {
      pwnedFailure = failure;
      const email = `fail-open-${failure}@example.com`;
      const response = await browser(app)
        .post('/v1/auth/sign-up/email')
        .send({ email, password: PASSWORD, name: 'Fail Open' });
      expect(response.status, JSON.stringify(response.body)).toBe(200);
      // Every request is also counted (pitchorium.http.server.requests): not the last call.
      expect(increment).toHaveBeenCalledWith(PWNED_CHECK_UNAVAILABLE_METRIC, {
        reason: failure,
        path: '/sign-up/email',
      });
      const users = await query('SELECT id FROM identity.users WHERE email = $1', [email]);
      expect(users).toHaveLength(1);
    }
  });

  it('holds no connection while the OAuth provider exchanges the code', async () => {
    const agent = browser(app);
    const started = await agent
      .post('/v1/auth/sign-in/social')
      .send({ provider: 'google', callbackURL: `${TEST_WEB_APP_URL}/home` })
      .expect(200);
    const state = new URL(started.body.url as string).searchParams.get('state');
    const code = providers.issueCode('google', {
      subject: 'google-slow',
      email: 'slow@example.com',
      emailVerified: true,
      name: 'Slow Provider',
    });

    const tokenRequest = providers.pauseNextTokenRequest();
    const callback = agent
      .get('/v1/auth/callback/google')
      .query({ code, state })
      .then((response) => response);
    await tokenRequest.reached;
    try {
      await expectNoConnectionHeld();
    } finally {
      tokenRequest.release();
    }

    const response = await callback;
    expect(response.status).toBe(302);
    expect(response.headers['location']).toBe(`${TEST_WEB_APP_URL}/home`);
    const events = await query<{ event_type: string }>(
      'SELECT event_type FROM platform.outbox_events ORDER BY occurred_at',
    );
    expect(events.map((event) => event.event_type)).toEqual([
      'identity.user.registered.v1',
      'identity.user.email-verified.v1',
    ]);
  });

  it('holds no connection while Have I Been Pwned checks a new password', async () => {
    const gate = pause();
    pwnedPause = gate;
    const signUp = browser(app)
      .post('/v1/auth/sign-up/email')
      .send({ email: 'pwned-check@example.com', password: PASSWORD, name: 'Checked' })
      .then((response) => response);
    await gate.reached;
    try {
      await expectNoConnectionHeld();
    } finally {
      gate.release();
    }

    expect((await signUp).status).toBe(200);
    expect(await query('SELECT id FROM identity.users')).toHaveLength(1);
  });

  it('keeps an account write and its event atomic', async () => {
    vi.spyOn(app.get(OutboxService), 'record').mockRejectedValueOnce(new Error('outbox down'));

    const failed = await browser(app)
      .post('/v1/auth/sign-up/email')
      .send({ email: 'atomic@example.com', password: PASSWORD, name: 'Atomic' });
    expect(failed.status, JSON.stringify(failed.body)).not.toBe(200);
    expect(await query('SELECT id FROM identity.users')).toHaveLength(0);
    expect(await query('SELECT id FROM identity.accounts')).toHaveLength(0);
    expect(await query('SELECT id FROM platform.outbox_events')).toHaveLength(0);

    await browser(app)
      .post('/v1/auth/sign-up/email')
      .send({ email: 'atomic@example.com', password: PASSWORD, name: 'Atomic' })
      .expect(200);
    expect(await query('SELECT id FROM identity.users')).toHaveLength(1);
    expect(
      await query('SELECT id FROM platform.outbox_events WHERE event_type = $1', [
        'identity.user.registered.v1',
      ]),
    ).toHaveLength(1);
  });
});

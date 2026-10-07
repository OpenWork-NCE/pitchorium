import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { TEST_API_URL, TEST_WEB_APP_URL } from './support/environment';
import { linkIn, Mailpit } from './support/mailpit';
import { type Agent, browser, PASSWORD, signIn, signUp } from './support/members';
import {
  type FakeIdentity,
  FakeOAuthProviders,
  type FakeProvider,
} from './support/oauth-providers';

const AUTH_LINK = `${TEST_API_URL}/v1/auth/`;

/** Path and query of an absolute api URL, to call it on the in-process app. */
const pathOf = (url: string) => {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
};

const eventsOf = (type: string) =>
  query<{ aggregate_id: string; payload: Record<string, unknown> }>(
    'SELECT aggregate_id, payload FROM platform.outbox_events WHERE event_type = $1 ORDER BY occurred_at',
    [type],
  );

describe('identity', () => {
  let app: NestExpressApplication;
  const mailpit = new Mailpit();
  const providers = new FakeOAuthProviders();

  beforeAll(async () => {
    await providers.start();
    ({ app } = await createApiTestApp());
  });

  afterAll(async () => {
    await app.close();
    await providers.stop();
  });

  beforeEach(async () => {
    await truncateAllTables();
    await mailpit.clear();
  });

  describe('email and password', () => {
    it('signs up, verifies the email from the received link and opens a session', async () => {
      const agent = browser(app).set('Accept-Language', 'en-GB,en;q=0.9');
      await signUp(agent, 'ada@example.com', 'Ada Lovelace');
      await agent.get('/v1/me').expect(401);

      const email = await mailpit.waitFor('ada@example.com', 'Confirm your email address');
      const verification = await agent
        .get(pathOf(linkIn(email, `${AUTH_LINK}verify-email`)))
        .expect(302);
      expect(verification.headers['location']).toBe(`${TEST_WEB_APP_URL}/welcome`);

      const me = await agent.get('/v1/me').expect(200);
      expect(me.body).toMatchObject({
        user: { email: 'ada@example.com', emailVerified: true, name: 'Ada Lovelace' },
        preferences: { locale: 'en' },
        roles: ['member'],
        legal: { upToDate: false },
        trust: { emailVerified: true, kycVerified: false, suspended: false },
        profile: { handle: 'ada-lovelace', displayName: 'Ada Lovelace' },
      });
      const [registered] = await eventsOf('identity.user.registered.v1');
      expect(registered?.payload).toEqual({
        method: 'credential',
        locale: 'en',
        emailVerified: false,
      });
      expect(await eventsOf('identity.user.email-verified.v1')).toHaveLength(1);
    });

    it('answers a sign-up with a known email exactly like a new one', async () => {
      const first = await browser(app)
        .post('/v1/auth/sign-up/email')
        .send({ email: 'known@example.com', password: PASSWORD, name: 'First' })
        .expect(200);
      const second = await browser(app)
        .post('/v1/auth/sign-up/email')
        .send({ email: 'known@example.com', password: PASSWORD, name: 'Second' })
        .expect(200);

      expect(Object.keys(second.body as object).sort()).toEqual(
        Object.keys(first.body as object).sort(),
      );
      expect(Object.keys(second.body.user as object).sort()).toEqual(
        Object.keys(first.body.user as object).sort(),
      );
      expect(second.headers['set-cookie']).toBeUndefined();
      expect(await query('SELECT id FROM identity.users')).toHaveLength(1);
    });

    it('signs in with a password that is not revealed by the error message', async () => {
      await signUp(browser(app), 'grace@example.com');
      const wrongPassword = await browser(app)
        .post('/v1/auth/sign-in/email')
        .send({ email: 'grace@example.com', password: 'not the right password' })
        .expect(401);
      const unknownAccount = await browser(app)
        .post('/v1/auth/sign-in/email')
        .send({ email: 'nobody@example.com', password: 'not the right password' })
        .expect(401);
      expect(unknownAccount.body).toEqual(wrongPassword.body);
    });

    it('refuses passwords shorter than 12 characters', async () => {
      const response = await browser(app)
        .post('/v1/auth/sign-up/email')
        .send({ email: 'short@example.com', password: 'elevenchars', name: 'Short' })
        .expect(400);
      expect(response.body.code).toBe('PASSWORD_TOO_SHORT');
    });
  });

  describe('magic link', () => {
    it('creates the account on first use and works only once', async () => {
      const agent = browser(app);
      await agent
        .post('/v1/auth/sign-in/magic-link')
        .send({ email: 'link@example.com', callbackURL: `${TEST_WEB_APP_URL}/home` })
        .expect(200);
      const email = await mailpit.waitFor('link@example.com', 'Votre lien de connexion');
      const link = pathOf(linkIn(email, `${AUTH_LINK}magic-link/verify`));

      const first = await agent.get(link).expect(302);
      expect(first.headers['location']).toBe(`${TEST_WEB_APP_URL}/home`);
      const me = await agent.get('/v1/me').expect(200);
      expect(me.body.user).toMatchObject({ email: 'link@example.com', emailVerified: true });
      const [registered] = await eventsOf('identity.user.registered.v1');
      expect(registered?.payload).toMatchObject({ method: 'magic_link' });

      const replay = await browser(app).get(link).expect(302);
      expect(replay.headers['location']).toContain('error=');
    });
  });

  describe('password reset', () => {
    it('resets with a single-use emailed token and signs out every session', async () => {
      const signedIn = browser(app);
      await signUp(signedIn, 'reset@example.com');
      await signIn(signedIn, 'reset@example.com');

      await browser(app)
        .post('/v1/auth/request-password-reset')
        .send({ email: 'reset@example.com', redirectTo: `${TEST_WEB_APP_URL}/reset` })
        .expect(200);
      const unknown = await browser(app)
        .post('/v1/auth/request-password-reset')
        .send({ email: 'nobody@example.com', redirectTo: `${TEST_WEB_APP_URL}/reset` })
        .expect(200);
      expect(unknown.body).toEqual({ status: true, message: expect.any(String) as string });

      const email = await mailpit.waitFor('reset@example.com', 'Réinitialisation');
      const redirect = await browser(app)
        .get(pathOf(linkIn(email, `${AUTH_LINK}reset-password/`)))
        .expect(302);
      const token = new URL(redirect.headers['location'] as string).searchParams.get('token');
      expect(token).toBeTruthy();

      const newPassword = 'another long passphrase';
      await browser(app).post('/v1/auth/reset-password').send({ newPassword, token }).expect(200);
      await browser(app).post('/v1/auth/reset-password').send({ newPassword, token }).expect(400);

      await signedIn.get('/v1/me').expect(401);
      await signIn(browser(app), 'reset@example.com', newPassword);
      expect((await eventsOf('identity.user.password-changed.v1'))[0]?.payload).toEqual({
        reason: 'reset',
      });
      expect((await eventsOf('identity.user.sessions-revoked.v1'))[0]?.payload).toEqual({
        scope: 'all',
        reason: 'password_reset',
      });
    });
  });

  describe('OAuth providers', () => {
    async function oauth(
      agent: Agent,
      provider: FakeProvider,
      identity: FakeIdentity,
    ): Promise<string> {
      const started = await agent
        .post('/v1/auth/sign-in/social')
        .send({
          provider,
          callbackURL: `${TEST_WEB_APP_URL}/home`,
          errorCallbackURL: `${TEST_WEB_APP_URL}/auth/error`,
        })
        .expect(200);
      const state = new URL(started.body.url as string).searchParams.get('state');
      const code = providers.issueCode(provider, identity);
      const callback = await agent
        .get(`/v1/auth/callback/${provider}`)
        .query({ code, state })
        .expect(302);
      return callback.headers['location'] as string;
    }

    async function accountsOf(email: string): Promise<string[]> {
      const rows = await query<{ provider_id: string }>(
        `SELECT a.provider_id FROM identity.accounts a JOIN identity.users u ON u.id = a.user_id
         WHERE u.email = $1 ORDER BY a.provider_id`,
        [email],
      );
      return rows.map((row) => row.provider_id);
    }

    async function verifiedPasswordAccount(email: string): Promise<void> {
      await signUp(browser(app), email);
      await query('UPDATE identity.users SET email_verified = true WHERE email = $1', [email]);
    }

    it('creates an account pre-filled with name and photo only', async () => {
      const agent = browser(app);
      const location = await oauth(agent, 'google', {
        subject: 'google-1',
        email: 'new@gmail.test',
        emailVerified: true,
        name: 'Nouvel Utilisateur',
        picture: 'https://lh3.googleusercontent.test/photo.jpg',
      });

      expect(location).toBe(`${TEST_WEB_APP_URL}/home`);
      const me = await agent.get('/v1/me').expect(200);
      expect(me.body.user).toMatchObject({ email: 'new@gmail.test', emailVerified: true });
      expect(me.body.profile).toMatchObject({
        displayName: 'Nouvel Utilisateur',
        avatarUrl: 'https://lh3.googleusercontent.test/photo.jpg',
        headline: null,
      });
      expect((await eventsOf('identity.user.registered.v1'))[0]?.payload).toMatchObject({
        method: 'google',
        emailVerified: true,
      });
    });

    it('links Google implicitly when both emails are verified', async () => {
      await verifiedPasswordAccount('both@example.com');

      const location = await oauth(browser(app), 'google', {
        subject: 'google-2',
        email: 'both@example.com',
        emailVerified: true,
        name: 'Both',
      });

      expect(location).toBe(`${TEST_WEB_APP_URL}/home`);
      expect(await accountsOf('both@example.com')).toEqual(['credential', 'google']);
      expect((await eventsOf('identity.account.linked.v1'))[0]?.payload).toEqual({
        provider: 'google',
      });
    });

    it('never links Microsoft implicitly, even with a matching email', async () => {
      await verifiedPasswordAccount('target@example.com');

      const location = await oauth(browser(app), 'microsoft', {
        subject: 'entra-oid-1',
        email: 'target@example.com',
        emailVerified: true,
        name: 'Attacker',
      });

      expect(location).toBe(`${TEST_WEB_APP_URL}/auth/error?error=account_not_linked`);
      expect(await accountsOf('target@example.com')).toEqual(['credential']);
      expect(await eventsOf('identity.account.linked.v1')).toHaveLength(0);
    });

    it('does not trust an unverified provider email', async () => {
      await verifiedPasswordAccount('victim@example.com');
      const refused = await oauth(browser(app), 'google', {
        subject: 'google-3',
        email: 'victim@example.com',
        emailVerified: false,
        name: 'Unverified',
      });
      expect(refused).toBe(`${TEST_WEB_APP_URL}/auth/error?error=account_not_linked`);
      expect(await accountsOf('victim@example.com')).toEqual(['credential']);

      const agent = browser(app);
      await oauth(agent, 'linkedin', {
        subject: 'linkedin-1',
        email: 'fresh@example.com',
        emailVerified: false,
        name: 'Fresh',
      });
      const me = await agent.get('/v1/me').expect(200);
      expect(me.body.user).toMatchObject({ email: 'fresh@example.com', emailVerified: false });
    });

    it('treats a LinkedIn email_verified claim as a verified email', async () => {
      const agent = browser(app);
      await oauth(agent, 'linkedin', {
        subject: 'linkedin-2',
        email: 'pro@example.com',
        emailVerified: true,
        name: 'Pro',
      });
      expect((await agent.get('/v1/me').expect(200)).body.user.emailVerified).toBe(true);
    });
  });

  describe('sessions', () => {
    it('lists sessions, revokes the others and warns about a new device', async () => {
      await signUp(browser(app), 'multi@example.com');
      const laptop = browser(app).set('User-Agent', 'Laptop');
      const phone = browser(app).set('User-Agent', 'Phone');
      await signIn(laptop, 'multi@example.com');
      await signIn(phone, 'multi@example.com');
      await mailpit.waitFor('multi@example.com', 'Nouvelle connexion');

      const sessions = await laptop.get('/v1/auth/list-sessions').expect(200);
      expect(sessions.body).toHaveLength(2);

      await laptop.post('/v1/auth/revoke-other-sessions').send({}).expect(200);
      await phone.get('/v1/me').expect(401);
      await laptop.get('/v1/me').expect(200);
      expect((await eventsOf('identity.user.sessions-revoked.v1'))[0]?.payload).toEqual({
        scope: 'others',
        reason: 'user_request',
      });

      await laptop.post('/v1/auth/revoke-sessions').send({}).expect(200);
      await laptop.get('/v1/me').expect(401);
    });
  });

  describe('cross-site protection', () => {
    it('refuses cookie-authenticated writes from an untrusted or missing Origin', async () => {
      const agent = browser(app);
      await signUp(agent, 'csrf@example.com');
      const sessionCookie = await signIn(agent, 'csrf@example.com');

      const evil = await agent
        .put('/v1/me/preferences')
        .set('Origin', 'https://evil.example')
        .send({ locale: 'en' })
        .expect(403);
      expect(evil.body.code).toBe('ACCESS_ORIGIN_NOT_ALLOWED');

      const noOrigin = await request(app.getHttpServer())
        .put('/v1/me/preferences')
        .set('Cookie', sessionCookie)
        .send({ locale: 'en' })
        .expect(403);
      expect(noOrigin.body.code).toBe('ACCESS_ORIGIN_NOT_ALLOWED');

      await agent
        .post('/v1/auth/sign-out')
        .set('Origin', 'https://evil.example')
        .send({})
        .expect(403);
      await agent.put('/v1/me/preferences').send({ locale: 'en' }).expect(200);
    });
  });

  describe('rate limiting', () => {
    it('limits sign-in attempts per client', async () => {
      // A dedicated window keeps these counters apart from the other tests.
      const limited = await createApiTestApp([], {
        AUTH_RATE_LIMIT_MAX: '3',
        AUTH_RATE_LIMIT_WINDOW_SECONDS: '59',
      });
      try {
        const attempt = () =>
          browser(limited.app)
            .post('/v1/auth/sign-in/email')
            .send({ email: 'limited@example.com', password: 'wrong password here' });
        for (let index = 0; index < 3; index += 1) expect((await attempt()).status).toBe(401);
        const blocked = await attempt();
        expect(blocked.status).toBe(429);
        expect(Number(blocked.headers['x-retry-after'])).toBeGreaterThan(0);
      } finally {
        await limited.app.close();
      }
    });
  });
});

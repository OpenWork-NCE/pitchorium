import type { NestExpressApplication } from '@nestjs/platform-express';
import { Redis } from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createApiTestApp } from './support/api-app';
import { truncateAllTables } from './support/database';
import { TEST_WEB_APP_URL } from './support/environment';
import { browser, PASSWORD } from './support/members';

/** Official test keys of Cloudflare: the real siteverify answers, without a challenge. */
const SITE_KEY_PASSES = '1x00000000000000000000AA';
const SECRET_PASSES = '1x0000000000000000000000000000000AA';
const SECRET_FAILS = '2x0000000000000000000000000000000AA';
/** Token that the test site keys produce in a browser. */
const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

const NOTICE = {
  targetType: 'post',
  targetId: '01970000-0000-7000-8000-000000000000',
  details: 'Ce contenu reproduit un document confidentiel volé.',
  goodFaith: true,
};

/** The notices without an account of earlier test files used up the hourly limit of 127.0.0.1. */
async function resetRateLimits(): Promise<void> {
  const redis = new Redis(inject('redisUrl'));
  await redis.flushdb();
  redis.disconnect();
}

async function withTurnstile(secret: string): Promise<NestExpressApplication> {
  await resetRateLimits();
  const { app } = await createApiTestApp([], {
    TURNSTILE_SITE_KEY: SITE_KEY_PASSES,
    TURNSTILE_SECRET_KEY: secret,
    TURNSTILE_APPEARANCE: 'always',
  });
  return app;
}

describe('Cloudflare Turnstile (ADR 0103)', () => {
  describe('with a secret that accepts every token', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      await truncateAllTables();
      app = await withTurnstile(SECRET_PASSES);
    });

    afterAll(async () => {
      await app.close();
    });

    it('publishes the site key, never the secret, with the providers and legal versions', async () => {
      const response = await request(app.getHttpServer()).get('/v1/auth-configuration').expect(200);
      expect(response.body).toEqual({
        oauthProviders: ['google', 'linkedin', 'microsoft'],
        turnstile: { siteKey: SITE_KEY_PASSES, appearance: 'always' },
        legal: {
          termsVersion: expect.any(String),
          privacyVersion: expect.any(String),
          minimumAge: 18,
        },
        minPasswordLength: 12,
      });
      expect(JSON.stringify(response.body)).not.toContain(SECRET_PASSES);
    });

    it('refuses sign-up, sign-in, magic link and reset without a token', async () => {
      const agent = browser(app);
      const calls = [
        () =>
          agent.post('/v1/auth/sign-up/email').send({
            email: 'nadia@example.com',
            password: PASSWORD,
            name: 'Nadia',
            callbackURL: TEST_WEB_APP_URL,
          }),
        () =>
          agent
            .post('/v1/auth/sign-in/email')
            .send({ email: 'nadia@example.com', password: PASSWORD }),
        () => agent.post('/v1/auth/sign-in/magic-link').send({ email: 'nadia@example.com' }),
        () => agent.post('/v1/auth/request-password-reset').send({ email: 'nadia@example.com' }),
      ];
      for (const call of calls) {
        const response = await call();
        expect(response.status).toBe(400);
        expect(response.body.code).toBe('MISSING_RESPONSE');
      }
    });

    it('lets a valid token through on sign-up and sign-in', async () => {
      const agent = browser(app).set('X-Captcha-Response', DUMMY_TOKEN);
      await agent
        .post('/v1/auth/sign-up/email')
        .send({
          email: 'awa@example.com',
          password: PASSWORD,
          name: 'Awa',
          callbackURL: TEST_WEB_APP_URL,
        })
        .expect(200);
      await agent
        .post('/v1/auth/sign-in/email')
        .send({ email: 'awa@example.com', password: PASSWORD })
        .expect(200);
    });

    it('checks the notice without an account before anything else', async () => {
      const missing = await request(app.getHttpServer()).post('/v1/public/reports').send(NOTICE);
      expect([missing.status, missing.body.code]).toEqual([400, 'CAPTCHA_REQUIRED']);
      // Past the check, the unknown target answers as without Turnstile.
      const passed = await request(app.getHttpServer())
        .post('/v1/public/reports')
        .set('X-Captcha-Response', DUMMY_TOKEN)
        .send(NOTICE);
      expect(passed.status).toBe(404);
    });
  });

  describe('with a secret that rejects every token', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      app = await withTurnstile(SECRET_FAILS);
    });

    afterAll(async () => {
      await app.close();
    });

    it('refuses the token on /v1/auth and on the notice without an account', async () => {
      const signIn = await browser(app)
        .set('X-Captcha-Response', DUMMY_TOKEN)
        .post('/v1/auth/sign-in/email')
        .send({ email: 'awa@example.com', password: PASSWORD });
      expect([signIn.status, signIn.body.code]).toEqual([403, 'VERIFICATION_FAILED']);
      const notice = await request(app.getHttpServer())
        .post('/v1/public/reports')
        .set('X-Captcha-Response', DUMMY_TOKEN)
        .send(NOTICE);
      expect([notice.status, notice.body.code]).toEqual([403, 'CAPTCHA_FAILED']);
    });
  });
});

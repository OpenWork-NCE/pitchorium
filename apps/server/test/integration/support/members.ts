import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { expect } from 'vitest';
import { query } from './database';
import { TEST_LEGAL_VERSION, TEST_WEB_APP_URL } from './environment';
import { totp } from './totp';

export const PASSWORD = 'correct horse battery staple';

export type Agent = ReturnType<typeof request.agent>;

/** Supertest agent that keeps cookies and sends the trusted Origin, like the web app. */
export function browser(app: NestExpressApplication): Agent {
  return request.agent(app.getHttpServer()).set('Origin', TEST_WEB_APP_URL);
}

export async function signUp(agent: Agent, email: string, name = 'Test Member'): Promise<void> {
  await agent
    .post('/v1/auth/sign-up/email')
    .send({ email, password: PASSWORD, name, callbackURL: `${TEST_WEB_APP_URL}/welcome` })
    .expect(200);
}

/** Returns the session cookies as a Cookie header value. */
export async function signIn(agent: Agent, email: string, password = PASSWORD): Promise<string> {
  const response = await agent.post('/v1/auth/sign-in/email').send({ email, password });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  const cookies = (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

export async function acceptLegal(agent: Agent): Promise<void> {
  await agent
    .post('/v1/me/legal-acceptances')
    .set('Idempotency-Key', `legal-${Date.now()}-${Math.random()}`)
    .send({
      termsVersion: TEST_LEGAL_VERSION,
      privacyVersion: TEST_LEGAL_VERSION,
      adultDeclaration: true,
    })
    .expect(201);
}

export interface Member {
  agent: Agent;
  email: string;
  userId: string;
}

/**
 * Signed-in member with a verified email and accepted terms. The email is marked verified in
 * the database: the verification link itself is covered by the identity tests.
 */
export async function createMember(
  app: NestExpressApplication,
  email: string,
  options: { name?: string; verified?: boolean; legal?: boolean } = {},
): Promise<Member> {
  const agent = browser(app);
  await signUp(agent, email, options.name);
  if (options.verified !== false) {
    await query('UPDATE identity.users SET email_verified = true WHERE email = $1', [email]);
  }
  await signIn(agent, email);
  if (options.legal !== false) await acceptLegal(agent);
  const [user] = await query<{ id: string }>('SELECT id FROM identity.users WHERE email = $1', [
    email,
  ]);
  if (!user) throw new Error(`User ${email} not created`);
  return { agent, email, userId: user.id };
}

/** Window of the rate limit of Better Auth on `/two-factor/*`: 3 requests per 10 seconds. */
const TWO_FACTOR_WINDOW_MS = 10_000;

/**
 * Sends a request to `/two-factor/*`, waiting for the next window of the rate limit of the
 * two-factor plugin when the tests of every file, from the same address, used it up.
 */
export async function twoFactorRequest(send: () => request.Test): Promise<request.Response> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await send();
    if (response.status !== 429 || attempt === 2) return response;
    await new Promise((resolve) => setTimeout(resolve, TWO_FACTOR_WINDOW_MS));
  }
}

/** Grants a platform role to a member, who then enables two-factor authentication. */
export async function grantRoleWith2fa(member: Member, role: 'moderator' | 'admin'): Promise<void> {
  await query(
    `INSERT INTO access.role_assignments (user_id, role, granted_at) VALUES ($1, $2, now())`,
    [member.userId, role],
  );
  const enabled = await twoFactorRequest(() =>
    member.agent.post('/v1/auth/two-factor/enable').send({ password: PASSWORD }),
  );
  expect(enabled.status).toBe(200);
  const verified = await twoFactorRequest(() =>
    member.agent
      .post('/v1/auth/two-factor/verify-totp')
      .send({ code: totp(enabled.body.totpURI as string) }),
  );
  expect(verified.status).toBe(200);
}

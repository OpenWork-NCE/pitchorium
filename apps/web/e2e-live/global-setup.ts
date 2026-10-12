import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { request } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_STATE,
  API_URL,
  DEMO_STAFF_TOTP_BASE32,
  MODERATOR_EMAIL,
  MODERATOR_STATE,
  TEST_CAPTCHA_TOKEN,
  unusedTotp,
  WEB_URL,
} from './support';

const DEMO_PASSWORD = 'pitchorium-demo-2026';

/**
 * Once per run: the staff of the journeys sign in with the second factor their role requires
 * (the one of the demonstration data, or turned on here), and their sessions are kept (ADR 0050). The administrator (a demonstration moderator promoted by
 * scripts/e2e-live.sh, `admin:create`) reviews an identity check and decides on a report; a second
 * demonstration moderator resolves the appeal of that decision, which its author may not do. A
 * code of an authenticator is used once: one sign-in for the whole run. Without the role
 * (servers started by hand without the demonstration data), the state is not written and those
 * journeys are skipped.
 */
export default async function globalSetup(): Promise<void> {
  await signInStaff(ADMIN_EMAIL, ADMIN_STATE, 'admin');
  await signInStaff(MODERATOR_EMAIL, MODERATOR_STATE, 'moderator');
}

async function signInStaff(email: string, statePath: string, role: string): Promise<void> {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify({ cookies: [], origins: [] }));
  // The second factor of the account, for a run against servers already started.
  const secretFile = join(dirname(statePath), `${role}-secret.json`);
  // The token of a challenge passed with the test keys of Turnstile, as `api()` sends it.
  const context = await request.newContext({
    extraHTTPHeaders: { origin: WEB_URL, 'x-captcha-response': TEST_CAPTCHA_TOKEN },
  });
  try {
    const signIn = await context.post(`${API_URL}/v1/auth/sign-in/email`, {
      data: { email, password: DEMO_PASSWORD },
    });
    if (!signIn.ok()) throw new Error(`Sign-in of ${email}: ${await signIn.text()}`);
    const body = (await signIn.json()) as { twoFactorRedirect?: boolean };
    if (body.twoFactorRedirect) {
      // The second factor of the demonstration data first (a new stack), then one turned on by
      // an earlier run against the same servers; the one that works is kept for the journeys
      // (staffSecret). A secret left by another stack never hides the staff of this one.
      const kept = existsSync(secretFile)
        ? (JSON.parse(readFileSync(secretFile, 'utf8')) as { secret: string }).secret
        : null;
      let secret: string | null = null;
      for (const candidate of [
        ...new Set([DEMO_STAFF_TOTP_BASE32, kept ?? DEMO_STAFF_TOTP_BASE32]),
      ]) {
        const verified = await context.post(`${API_URL}/v1/auth/two-factor/verify-totp`, {
          data: { code: await unusedTotp(email, candidate) },
        });
        if (verified.ok()) {
          secret = candidate;
          break;
        }
      }
      if (!secret) throw new Error(`No second factor of ${email} is accepted.`);
      writeFileSync(secretFile, JSON.stringify({ secret }));
    } else {
      const me = (await (await context.get(`${API_URL}/v1/me`)).json()) as { roles: string[] };
      if (!me.roles.includes(role)) return;
      const enabled = await context.post(`${API_URL}/v1/auth/two-factor/enable`, {
        data: { password: DEMO_PASSWORD },
      });
      if (!enabled.ok()) throw new Error(`two-factor/enable: ${await enabled.text()}`);
      const { totpURI } = (await enabled.json()) as { totpURI: string };
      const secret = new URL(totpURI).searchParams.get('secret')!;
      writeFileSync(secretFile, JSON.stringify({ secret }));
      const verified = await context.post(`${API_URL}/v1/auth/two-factor/verify-totp`, {
        data: { code: await unusedTotp(email, secret) },
      });
      if (!verified.ok()) throw new Error(`two-factor/verify-totp: ${await verified.text()}`);
    }
    await context.storageState({ path: statePath });
  } finally {
    await context.dispose();
  }
}

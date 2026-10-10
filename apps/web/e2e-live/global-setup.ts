import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { request } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_STATE, API_URL, TEST_CAPTCHA_TOKEN, totp, WEB_URL } from './support';

const DEMO_PASSWORD = 'pitchorium-demo-2026';
/** The second factor of the administrator, for a run against servers already started. */
const SECRET_FILE = join(dirname(ADMIN_STATE), 'admin-secret.json');

/**
 * Once per run: the administrator of the journeys (a demonstration moderator promoted by
 * scripts/e2e-live.sh, `admin:create`) turns on the second factor its role requires, and its
 * session is kept for the journeys that review an identity check (ADR 0050). A code of an
 * authenticator is used once: one sign-in for the whole run. Without the role (servers started
 * by hand without `admin:create`), the state is not written and those journeys are skipped.
 */
export default async function globalSetup(): Promise<void> {
  mkdirSync(dirname(ADMIN_STATE), { recursive: true });
  writeFileSync(ADMIN_STATE, JSON.stringify({ cookies: [], origins: [] }));
  // The token of a challenge passed with the test keys of Turnstile, as `api()` sends it.
  const context = await request.newContext({
    extraHTTPHeaders: { origin: WEB_URL, 'x-captcha-response': TEST_CAPTCHA_TOKEN },
  });
  try {
    const signIn = await context.post(`${API_URL}/v1/auth/sign-in/email`, {
      data: { email: ADMIN_EMAIL, password: DEMO_PASSWORD },
    });
    if (!signIn.ok()) throw new Error(`Sign-in of the administrator: ${await signIn.text()}`);
    const body = (await signIn.json()) as { twoFactorRedirect?: boolean };
    if (body.twoFactorRedirect) {
      // A second factor turned on by an earlier run against the same servers.
      const secret = (JSON.parse(readFileSync(SECRET_FILE, 'utf8')) as { secret: string }).secret;
      const verified = await context.post(`${API_URL}/v1/auth/two-factor/verify-totp`, {
        data: { code: await totp(secret) },
      });
      if (!verified.ok()) return;
    } else {
      const me = (await (await context.get(`${API_URL}/v1/me`)).json()) as { roles: string[] };
      if (!me.roles.includes('admin')) return;
      const enabled = await context.post(`${API_URL}/v1/auth/two-factor/enable`, {
        data: { password: DEMO_PASSWORD },
      });
      if (!enabled.ok()) throw new Error(`two-factor/enable: ${await enabled.text()}`);
      const { totpURI } = (await enabled.json()) as { totpURI: string };
      const secret = new URL(totpURI).searchParams.get('secret')!;
      writeFileSync(SECRET_FILE, JSON.stringify({ secret }));
      const verified = await context.post(`${API_URL}/v1/auth/two-factor/verify-totp`, {
        data: { code: await totp(secret) },
      });
      if (!verified.ok()) throw new Error(`two-factor/verify-totp: ${await verified.text()}`);
    }
    await context.storageState({ path: ADMIN_STATE });
  } finally {
    await context.dispose();
  }
}

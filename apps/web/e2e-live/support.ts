import {
  type APIResponse,
  type Browser,
  type BrowserContext,
  expect,
  type Page,
} from '@playwright/test';

export const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';
export const PASSWORD = 'correct horse battery staple 2026';

/** A fresh address per journey and browser, under a reserved test domain. */
export function freshEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@e2e.pitchorium.test`;
}

interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

/** The first link found in the last email sent to this very address (Mailpit). */
export async function linkFromInbox(address: string, pattern: RegExp): Promise<string> {
  let found: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}&limit=50`,
        );
        const { messages } = (await search.json()) as { messages: MailpitMessage[] };
        // The search matches words: only the messages sent to this very address count.
        const own = messages.filter((message) =>
          message.To.some((to) => to.Address.toLowerCase() === address.toLowerCase()),
        );
        for (const message of own) {
          const body = (await (
            await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`)
          ).json()) as {
            HTML: string;
            Text: string;
          };
          const match = `${body.Text}\n${body.HTML}`.match(pattern);
          if (match) {
            found = match[0].replaceAll('&amp;', '&');
            return true;
          }
        }
        return false;
      },
      { timeout: 30_000, intervals: [500, 1000] },
    )
    .toBe(true);
  return found!;
}

/** Signs up by email through the screens, then opens the verification link received. */
export async function signUpAndVerify(
  page: Page,
  email: string,
  name = 'Awa Diallo',
): Promise<void> {
  await page.goto('/fr/sign-up');
  await hydrated(page);
  await page.getByLabel('Nom', { exact: true }).fill(name);
  await page.getByLabel('Adresse email').fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe', exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('heading', { name: 'Vérifiez votre adresse' })).toBeVisible();
  const link = await linkFromInbox(email, /http[^\s"<>]*\/v1\/auth\/verify-email[^\s"<>]*/);
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Adresse vérifiée' })).toBeVisible();
}

/**
 * Waits until the client components of the page answer (hydrated), before acting on them: React
 * has taken over the document, then the network calms down, three seconds at most, since the
 * frame of Cloudflare Turnstile never leaves it idle.
 */
export async function hydrated(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const node = document.querySelector('a[href="#main"]') ?? document.body.firstElementChild;
    return node !== null && Object.keys(node).some((key) => key.startsWith('__reactFiber'));
  });
  await Promise.race([
    page.waitForLoadState('networkidle').catch(() => undefined),
    page.waitForTimeout(3_000),
  ]);
}

/** Accepts the three declarations of the terms step. */
export async function acceptTerms(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Conditions d’utilisation' })).toBeVisible();
  await hydrated(page);
  for (const name of [
    /conditions d’utilisation/,
    /politique de confidentialité/,
    /au moins 18 ans/,
  ]) {
    await page.getByRole('checkbox', { name }).check();
  }
  await page.getByRole('button', { name: 'Accepter et continuer' }).click();
}

/** Current code of an authenticator for a base32 secret (RFC 6238, SHA-1, 30 s, 6 digits). */
export async function totp(secret: string, at = Date.now()): Promise<string> {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of secret.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2);
  }
  const counter = new DataView(new ArrayBuffer(8));
  counter.setBigUint64(0, BigInt(Math.floor(at / 1000 / 30)));
  const key = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-1' }, false, [
    'sign',
  ]);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter.buffer));
  const offset = digest[digest.length - 1]! & 0x0f;
  const value =
    (((digest[offset]! & 0x7f) << 24) |
      (digest[offset + 1]! << 16) |
      (digest[offset + 2]! << 8) |
      digest[offset + 3]!) %
    1_000_000;
  return value.toString().padStart(6, '0');
}

/** A member signed up, verified and past the terms, on the feed. */
export async function onboardedMember(page: Page, label: string): Promise<string> {
  const email = freshEmail(label);
  await signUpAndVerify(page, email);
  await page.getByRole('link', { name: 'Continuer' }).click();
  await acceptTerms(page);
  await expect(page.getByRole('heading', { name: 'Qu’est-ce qui vous amène ?' })).toBeVisible();
  await page.goto('/fr/feed');
  return email;
}

/** Signs in through the email form of the sign-in page. */
export async function signInWithPassword(
  page: Page,
  email: string,
  password = PASSWORD,
): Promise<void> {
  await page.goto('/fr/sign-in/password');
  await hydrated(page);
  await page.getByLabel('Adresse email').fill(email);
  await page.getByRole('textbox', { name: 'Mot de passe', exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

/** Origins of the run (scripts/e2e-live.sh). */
export const WEB_URL = process.env.LIVE_WEB_URL ?? 'http://localhost:3200';
export const API_URL = process.env.LIVE_API_URL ?? 'http://localhost:3000';
export const FAKE_OAUTH_URL = process.env.FAKE_OAUTH_URL ?? 'http://127.0.0.1:3400';

/**
 * Token of a challenge passed with the test keys of Cloudflare Turnstile: the always-pass secret
 * key of the live environment accepts it (ADR 0103), for the members a journey creates through
 * the api rather than through the screens.
 */
const TEST_CAPTCHA_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

/** A call to the api with the cookies of the page, from the trusted origin of the web app. */
export async function api(
  page: Page,
  method: string,
  path: string,
  data?: unknown,
): Promise<APIResponse> {
  return page.request.fetch(`${API_URL}${path}`, {
    method,
    ...(data === undefined ? {} : { data }),
    maxRedirects: 0,
    headers: {
      origin: WEB_URL,
      'x-captcha-response': TEST_CAPTCHA_TOKEN,
      ...(method === 'GET' ? {} : { 'idempotency-key': crypto.randomUUID() }),
    },
  });
}

/** Expects a 2xx answer, with its body in the message otherwise. */
export async function ok(response: Promise<APIResponse> | APIResponse): Promise<APIResponse> {
  const answer = await response;
  expect(answer.status(), `${answer.url()}: ${await answer.text()}`).toBeLessThan(300);
  return answer;
}

export interface LiveMember {
  email: string;
  name: string;
  handle: string;
}

interface MemberOptions {
  name?: string;
  /** Title and country: the minimum profile (profile.minimum, ADR 0109); none when false. */
  profile?: { headline: string; countryCode: string } | false;
  /** Verified email (default) or not. */
  verified?: boolean;
}

/**
 * A new member created through the api and signed in in the browser context of the page:
 * verified email, terms accepted, minimum profile filled, unless the journey asks otherwise.
 */
export async function apiMember(
  page: Page,
  label: string,
  {
    name = 'Awa Diallo',
    profile = { headline: 'Fondatrice', countryCode: 'SN' },
    verified = true,
  }: MemberOptions = {},
): Promise<LiveMember> {
  const email = freshEmail(label);
  await ok(
    api(page, 'POST', '/v1/auth/sign-up/email', {
      email,
      password: PASSWORD,
      name,
      callbackURL: `${WEB_URL}/fr/continue`,
    }),
  );
  if (verified) {
    const link = await linkFromInbox(email, /http[^\s"<>]*\/v1\/auth\/verify-email[^\s"<>]*/);
    // The verification signs in (a session cookie of the api for this browser context).
    await page.request.get(link, { maxRedirects: 0 });
  } else {
    await ok(api(page, 'POST', '/v1/auth/sign-in/email', { email, password: PASSWORD }));
  }
  const legal = (await (await ok(api(page, 'GET', '/v1/legal-documents/current'))).json()) as {
    termsVersion: string;
    privacyVersion: string;
  };
  await ok(
    api(page, 'POST', '/v1/me/legal-acceptances', {
      termsVersion: legal.termsVersion,
      privacyVersion: legal.privacyVersion,
      adultDeclaration: true,
    }),
  );
  if (profile) await ok(api(page, 'PATCH', '/v1/me/profile', profile));
  const own = (await (await ok(api(page, 'GET', '/v1/me/profile'))).json()) as { handle: string };
  return { email, name, handle: own.handle };
}

type Provider = 'google' | 'linkedin' | 'microsoft';

const AUTHORIZE_URLS: Readonly<Record<Provider, RegExp>> = {
  google: /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/,
  linkedin: /^https:\/\/www\.linkedin\.com\/oauth\/v2\/authorization/,
  microsoft: /^https:\/\/login\.microsoftonline\.com\/common\/oauth2\/v2\.0\/authorize/,
};

/**
 * The consent of a provider, in the browser: its page is the fake providers' one, which consents
 * at once for the identity announced here and sends the browser back to the api with a code.
 */
export async function consentAs(
  page: Page,
  provider: Provider,
  identity: { subject: string; email: string; emailVerified: boolean; name: string },
): Promise<void> {
  const announced = await fetch(`${FAKE_OAUTH_URL}/__identity`, {
    method: 'POST',
    body: JSON.stringify({ provider, identity }),
  });
  expect(announced.status).toBe(204);
  await page.context().route(AUTHORIZE_URLS[provider], (route) => {
    const original = new URL(route.request().url());
    const target = `${FAKE_OAUTH_URL}/${provider}/authorize${original.search}`;
    // A page that goes on at once: WebKit refuses a redirect status from a fulfilled route.
    return route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><script>location.replace(${JSON.stringify(target)})</script>`,
    });
  });
}

/** A member signed in in a browser context of their own, with its page. */
export async function memberPage(
  browser: Browser,
  label: string,
  options: MemberOptions = {},
): Promise<{ page: Page; member: LiveMember; context: BrowserContext }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const member = await apiMember(page, label, options);
  return { page, member, context };
}

/**
 * A PNG drawn by the browser (a gradient, no metadata), at the size a media usage requires:
 * the media module checks the real type and the dimensions.
 */
export async function pngImage(page: Page, width: number, height: number) {
  const data = await page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext('2d')!;
      const gradient = context.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, '#5b2a86');
      gradient.addColorStop(1, '#e0a458');
      context.fillStyle = gradient;
      context.fillRect(0, 0, w, h);
      return canvas.toDataURL('image/png').split(',')[1]!;
    },
    [width, height] as const,
  );
  return { name: 'image.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') };
}

/**
 * Chooses an option of a select or a combobox of a form by its label: opens it, types to
 * filter a combobox (`search`), then picks the option.
 */
export async function choose(
  scope: Page | ReturnType<Page['getByRole']>,
  label: string,
  option: string | RegExp,
  search?: string,
): Promise<void> {
  const page = 'page' in scope ? scope.page() : scope;
  await scope.getByRole('combobox', { name: label }).click();
  if (search) await page.keyboard.type(search);
  await page.getByRole('option', { name: option }).first().click();
}

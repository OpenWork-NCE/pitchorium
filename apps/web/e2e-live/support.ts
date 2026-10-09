import { expect, type Page } from '@playwright/test';

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

/** The first link to the api found in the last email sent to this address (Mailpit). */
export async function linkFromInbox(address: string, pattern: RegExp): Promise<string> {
  let found: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}&limit=5`,
        );
        const { messages } = (await search.json()) as { messages: MailpitMessage[] };
        for (const message of messages) {
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

/** Waits until the client components of the page answer (hydrated), before acting on them. */
export async function hydrated(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
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

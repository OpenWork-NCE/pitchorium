import { type BrowserContext, expect, type Page } from '@playwright/test';
import { test } from '../support/clock';
import { API_ORIGIN, DEMO_PASSWORD } from '../support/fixtures';
import { layoutProblems } from './layout-guard';

/**
 * Screens of the console of the administration (PROMPT FRONT 9A), on the build of the end-to-end
 * tests served with the stub api (e2e/support/stub-admin.mjs, its fixed clock), in both themes
 * and both sizes (docs/design/review).
 */
const ORIGIN = 'http://localhost:3201';
const ADMIN = 'claudine.pierre.louis@demo.pitchorium.test';
const MODERATOR = 'koffi.agbodjan@demo.pitchorium.test';
const ID = (n: number) => `0192f4a0-9000-7000-8000-${String(n).padStart(12, '0')}`;
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

interface Screen {
  id: string;
  path: string;
  as: string;
  /** Cookies of the stub that put the api in a given state. */
  cookies?: string[];
  act?: (page: Page) => Promise<void>;
  /** A dialog: the capture is the viewport, not the full page behind it. */
  dialog?: boolean;
}

const SCREENS: Screen[] = [
  { id: 'console-dashboard-admin', path: '/fr/admin', as: ADMIN },
  { id: 'console-dashboard-moderator', path: '/fr/admin', as: MODERATOR },
  { id: 'console-moderation-queue', path: '/fr/admin/moderation', as: MODERATOR },
  {
    id: 'console-moderation-case',
    path: `/fr/admin/moderation/cases/${ID(802)}`,
    as: MODERATOR,
  },
  {
    id: 'console-moderation-freeze',
    path: `/fr/admin/moderation/cases/${ID(803)}`,
    as: ADMIN,
    act: async (page) => {
      await page.getByRole('radio', { name: /Gel du projet/ }).check();
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
  { id: 'console-appeals', path: '/fr/admin/moderation/appeals', as: MODERATOR },
  {
    id: 'console-transparency',
    path: '/fr/admin/moderation/transparency?from=2026-09-10&to=2026-10-09',
    as: ADMIN,
  },
  { id: 'console-members-search', path: '/fr/admin/members?q=demo', as: ADMIN },
  { id: 'console-member-file', path: `/fr/admin/members/${ID(1)}`, as: ADMIN },
  { id: 'console-verification-queue', path: '/fr/admin/organizations', as: MODERATOR },
  { id: 'console-verification-review', path: `/fr/admin/organizations/${ID(601)}`, as: MODERATOR },
  { id: 'console-contributions', path: '/fr/admin/payments/contributions', as: ADMIN },
  {
    id: 'console-refund-preview',
    path: `/fr/admin/payments/contributions/${ID(501)}`,
    as: ADMIN,
    act: async (page) => {
      const refund = page.locator('[aria-labelledby="refund-title"]');
      await refund.getByRole('button', { name: 'Une partie' }).click();
      await refund.getByLabel('Montant à rembourser').fill('30');
      await refund.getByLabel('Motif').fill('Demande du contributeur, doublon de paiement.');
      await refund.getByRole('button', { name: 'Voir l’effet' }).click();
      await expect(refund.getByText('Commission rendue')).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
  {
    id: 'console-reauthentication',
    path: `/fr/admin/payments/contributions/${ID(503)}`,
    as: ADMIN,
    cookies: ['stub-stale'],
    act: async (page) => {
      const refund = page.locator('[aria-labelledby="refund-title"]');
      await refund.getByLabel('Motif').fill('Projet annulé par son porteur.');
      await refund.getByRole('button', { name: 'Voir l’effet' }).click();
      await refund.getByRole('button', { name: 'Rembourser' }).click();
      const confirm = page.getByRole('alertdialog');
      await confirm.getByRole('textbox').fill('REMBOURSER');
      await confirm.getByRole('button', { name: 'Rembourser' }).click();
      await expect(page.getByRole('link', { name: 'Se reconnecter' })).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
  { id: 'console-offline', path: '/fr/admin/payments/offline', as: ADMIN },
  { id: 'console-kyc-queue', path: '/fr/admin/payments/kyc', as: ADMIN },
  { id: 'console-kyc-review', path: `/fr/admin/payments/kyc/${ID(101)}`, as: ADMIN },
  { id: 'console-discrepancies', path: '/fr/admin/payments/discrepancies', as: ADMIN },
  { id: 'console-methodologies', path: '/fr/admin/impact', as: ADMIN },
  { id: 'console-methodology-draft', path: `/fr/admin/impact/${ID(401)}`, as: ADMIN },
  { id: 'console-flags', path: '/fr/admin/flags', as: ADMIN },
  {
    id: 'console-flag-legal',
    path: '/fr/admin/flags',
    as: ADMIN,
    dialog: true,
    act: async (page) => {
      await page
        .locator('[aria-labelledby="flag-funding.equity"]')
        .getByRole('button', { name: 'Activer' })
        .click();
      await expect(page.getByRole('dialog', { name: 'Activer funding.equity ?' })).toBeVisible();
    },
  },
  { id: 'console-highlights', path: '/fr/admin/highlights', as: ADMIN },
  { id: 'console-jobs', path: '/fr/admin/jobs', as: ADMIN },
  { id: 'console-rights', path: '/fr/admin/privacy', as: ADMIN },
  { id: 'console-audit', path: '/fr/admin/audit', as: ADMIN },
  {
    id: 'console-shortcuts',
    path: '/fr/admin',
    as: ADMIN,
    dialog: true,
    act: async (page) => {
      await page.keyboard.press('Shift+?');
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
];

async function opened(context: BrowserContext, screen: Screen) {
  const tab = await context.newPage();
  const response = await tab.request.post(`${API_ORIGIN}/v1/auth/sign-in/email`, {
    data: { email: screen.as, password: DEMO_PASSWORD },
  });
  expect(response.ok()).toBe(true);
  for (const name of screen.cookies ?? []) {
    await context.addCookies([{ name, value: '1', url: API_ORIGIN }]);
  }
  return tab;
}

test.beforeEach(async ({ request }) => {
  await request.post(`${API_ORIGIN}/__test/reset`);
});

for (const screen of SCREENS) {
  for (const viewport of VIEWPORTS) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${screen.id} ${viewport.name} ${theme}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: theme,
          reducedMotion: 'reduce',
          locale: 'fr-FR',
        });
        const tab = await opened(context, screen);
        await tab.goto(`${ORIGIN}${screen.path}`);
        await tab.evaluate(() => document.fonts.ready);
        await tab.waitForLoadState('networkidle');
        await screen.act?.(tab);
        await tab.waitForLoadState('networkidle');
        await expect(tab.locator('main [aria-busy="true"]')).toHaveCount(0);
        await expect(tab.locator('main [data-loading]')).toHaveCount(0);
        expect(await layoutProblems(tab, 'body')).toEqual([]);
        await expect(tab).toHaveScreenshot(`${screen.id}-${viewport.name}-${theme}.png`, {
          animations: 'disabled',
          fullPage: !screen.dialog,
        });
        await context.close();
      });
    }
  }
}

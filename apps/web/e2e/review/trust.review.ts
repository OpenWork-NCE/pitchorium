import { type BrowserContext, expect, type Page } from '@playwright/test';
import { test } from '../support/clock';
import { API_ORIGIN, DEMO_PASSWORD } from '../support/fixtures';
import { layoutProblems } from './layout-guard';

/**
 * Screens of the reports, the moderation, the personal data and the translation (PROMPT FRONT
 * 8B), on the build of the end-to-end tests served with the stub api (e2e/support/stub-trust.mjs,
 * its fixed clock), in both themes and both sizes (docs/design/review).
 */
const ORIGIN = 'http://localhost:3201';
const MEMBER = 'aissatou.ba@demo.pitchorium.test';
const SUSPENDED = 'moussa.diop@demo.pitchorium.test';
const FREE = 'claudine.pierre.louis@demo.pitchorium.test';
const SCHEDULED = 'koffi.agbodjan@demo.pitchorium.test';
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

interface Screen {
  id: string;
  path: string;
  /** The account of the session, none for a visitor. */
  as: string | null;
  /** Brings the page to the state to capture. */
  act?: (page: Page) => Promise<void>;
  /** A dialog: the capture is the viewport, not the full page behind it. */
  dialog?: boolean;
}

function englishPost(page: Page) {
  return page.getByRole('article').filter({ hasText: 'Short and clear' });
}

const SCREENS: Screen[] = [
  {
    id: 'trust-report-dialog',
    path: '/fr/feed',
    as: MEMBER,
    dialog: true,
    act: async (page) => {
      await englishPost(page).getByRole('button', { name: 'Plus d’actions' }).click();
      await page.getByRole('menuitem', { name: 'Signaler' }).click();
      const dialog = page.getByRole('dialog', { name: 'Signaler cette publication' });
      await dialog.getByRole('radio', { name: 'Spam' }).check();
    },
  },
  { id: 'trust-notice', path: '/fr/report', as: null },
  { id: 'trust-moderation', path: '/fr/settings/moderation', as: SUSPENDED },
  {
    id: 'trust-appeal',
    path: '/fr/settings/moderation',
    as: SUSPENDED,
    act: async (page) => {
      await page.getByRole('button', { name: 'Faire appel' }).click();
      await expect(page.getByLabel('Vos arguments')).toBeVisible();
      // A full page from its top: the sticky header stays where it belongs.
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
  { id: 'trust-suspended-feed', path: '/fr/feed', as: SUSPENDED },
  { id: 'privacy-export-blocked', path: '/fr/settings/personal-data', as: MEMBER },
  { id: 'privacy-grace-period', path: '/fr/settings/personal-data', as: SCHEDULED },
  {
    id: 'privacy-erasure-confirm',
    path: '/fr/settings/personal-data',
    as: FREE,
    dialog: true,
    act: async (page) => {
      await page.getByRole('button', { name: 'Supprimer mon compte' }).click();
      const confirm = page.getByRole('alertdialog', { name: 'Supprimer votre compte ?' });
      await confirm.getByRole('textbox').fill('supprimer mon compte');
    },
  },
  { id: 'privacy-account-deleted', path: '/fr/account-deleted', as: null },
  {
    id: 'translation-in-place',
    path: '/fr/feed',
    as: MEMBER,
    act: async (page) => {
      const post = englishPost(page);
      await post.getByRole('button', { name: 'Traduire' }).click();
      await expect(post.getByRole('button', { name: 'Voir l’original' })).toBeVisible();
      await post.scrollIntoViewIfNeeded();
    },
    dialog: true,
  },
];

async function opened(context: BrowserContext, as: string | null) {
  const tab = await context.newPage();
  if (as) {
    const response = await tab.request.post(`${API_ORIGIN}/v1/auth/sign-in/email`, {
      data: { email: as, password: DEMO_PASSWORD },
    });
    expect(response.ok()).toBe(true);
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
        const tab = await opened(context, screen.as);
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

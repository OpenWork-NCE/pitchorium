import { type BrowserContext, expect, type Page } from '@playwright/test';
import { test } from '../support/clock';
import { API_ORIGIN, DEMO_PASSWORD } from '../support/fixtures';
import { layoutProblems } from './layout-guard';

/**
 * Screens of the search, Discover, the events, the missions and the pending invitations (PROMPT
 * FRONT 7), on the build of the end-to-end tests served with the stub api
 * (e2e/support/stub-discovery.mjs, fixed dates far ahead), in both themes and both sizes
 * (docs/design/review).
 */
const ORIGIN = 'http://localhost:3201';
const MEMBER = 'aissatou.ba@demo.pitchorium.test';
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

interface Screen {
  id: string;
  path: string;
  visitor?: boolean;
  /** Brings the page to the state to capture. */
  act?: (page: Page) => Promise<void>;
  /** Captures the viewport only (an open dialog over the page). */
  viewportOnly?: boolean;
}

const SCREENS: Screen[] = [
  {
    id: 'command-palette',
    path: '/fr/feed',
    viewportOnly: true,
    act: async (page) => {
      await page.keyboard.press('Control+k');
      const palette = page.getByRole('dialog', { name: 'Recherche globale' });
      await expect(palette.getByRole('combobox')).toBeFocused();
      await page.keyboard.type('sol');
      await expect(palette.getByRole('option', { name: /^Pompes solaires/ })).toBeVisible();
      await expect(palette.getByRole('listbox')).toHaveAttribute('aria-busy', 'false');
    },
  },
  { id: 'search-results', path: '/fr/search?q=solaire' },
  { id: 'search-empty', path: '/fr/search?q=zzzz' },
  { id: 'discover-visitor', path: '/fr/discover', visitor: true },
  { id: 'discover-member', path: '/fr/discover' },
  { id: 'events-list', path: '/fr/events' },
  { id: 'event-full', path: '/fr/events/atelier-levee-de-fonds' },
  { id: 'event-canceled', path: '/fr/events/rencontre-assureurs-kano' },
  { id: 'event-create', path: '/fr/events/new' },
  {
    id: 'settings-calendar',
    path: '/fr/settings/calendar',
    act: async (page) => {
      await page.getByRole('button', { name: 'Créer mon adresse de calendrier' }).click();
      await expect(page.getByText('Adresse secrète')).toBeVisible();
    },
  },
  { id: 'missions-list', path: '/fr/missions' },
  { id: 'mission-page', path: '/fr/missions/0192f4a0-7000-7000-8000-000000000301' },
  {
    id: 'mission-create-refused',
    path: '/fr/missions/new?direction=offer',
    act: async (page) => {
      await page.getByRole('textbox', { name: 'Titre' }).fill('Mentorat marketing');
      await page
        .getByRole('textbox', { name: 'Description' })
        .fill('Recrutement en CDI avec salaire attractif.');
      await page.getByRole('textbox', { name: 'Champ d’expertise' }).fill('Marketing');
      await page.getByRole('textbox', { name: 'Heures estimées' }).fill('4');
      await page.getByRole('button', { name: 'Publier la mission' }).click();
      await expect(
        page.getByText(/Une mission est bénévole\s: retirez le vocabulaire/).first(),
      ).toBeVisible();
    },
  },
  { id: 'invitations-pending', path: '/fr/network/invitations' },
];

async function opened(context: BrowserContext, visitor: boolean) {
  const tab = await context.newPage();
  if (!visitor) {
    const response = await tab.request.post(`${API_ORIGIN}/v1/auth/sign-in/email`, {
      data: { email: MEMBER, password: DEMO_PASSWORD },
    });
    expect(response.ok()).toBe(true);
  }
  return tab;
}

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
        const tab = await opened(context, screen.visitor ?? false);
        await tab.goto(`${ORIGIN}${screen.path}`);
        await tab.evaluate(() => document.fonts.ready);
        await tab.waitForLoadState('networkidle');
        await screen.act?.(tab);
        await expect(tab.locator('main [aria-busy="true"]')).toHaveCount(0);
        await expect(tab.locator('main [data-loading]')).toHaveCount(0);
        expect(await layoutProblems(tab, 'body')).toEqual([]);
        await expect(tab).toHaveScreenshot(`${screen.id}-${viewport.name}-${theme}.png`, {
          animations: 'disabled',
          fullPage: !screen.viewportOnly,
        });
        await context.close();
      });
    }
  }
}

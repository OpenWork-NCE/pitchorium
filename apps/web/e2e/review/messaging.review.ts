import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { API_ORIGIN, DEMO_PASSWORD } from '../support/fixtures';
import { layoutProblems } from './layout-guard';

/**
 * Screens of the messaging and the notifications (PROMPT FRONT 6), on the build of the
 * end-to-end tests served with the stub api (e2e/support/stub-messaging.mjs), in both themes and
 * both sizes (docs/design/review). The moments of the stub are fixed hours of the day or hours
 * before now: the captures read the same at every run.
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
  /** Without a session (the page of the link of an email). */
  visitor?: boolean;
  /** Brings the page to the state to capture. */
  act?: (page: Page) => Promise<void>;
}

/** The thread at its end and still: its files drawn, nothing left to move. */
async function settledThread(page: Page): Promise<void> {
  let previous = '';
  await expect
    .poll(async () => {
      const now = await page
        .locator('[data-thread-scroller]')
        .evaluate((e) =>
          JSON.stringify([e.scrollHeight, Math.round(e.scrollTop + e.clientHeight)]),
        );
      const [height, bottom] = JSON.parse(now) as [number, number];
      const still = now === previous && bottom >= height - 1;
      previous = now;
      return still;
    })
    .toBe(true);
}

/** The composer comes after the hydration; then the thread settles at its end. */
const hydrated = async (page: Page) => {
  await expect(page.getByRole('textbox', { name: 'Votre message' })).toBeVisible();
  await settledThread(page);
};

const SCREENS: Screen[] = [
  { id: 'messages-list', path: '/fr/messages' },
  {
    id: 'messages-thread',
    path: '/fr/messages/0192f4a0-6000-7000-8000-000000000001',
    act: hydrated,
  },
  {
    id: 'messages-group',
    path: '/fr/messages/0192f4a0-6000-7000-8000-000000000002',
    act: hydrated,
  },
  {
    id: 'messages-request',
    path: '/fr/messages/0192f4a0-6000-7000-8000-000000000003',
    act: hydrated,
  },
  {
    id: 'messages-new-request',
    path: '/fr/messages/new?to=claudine-pierre-louis',
    // No thread yet: the composer is enough.
    act: async (page) => {
      await expect(page.getByRole('textbox', { name: 'Votre message' })).toBeVisible();
    },
  },
  { id: 'introductions', path: '/fr/introductions' },
  { id: 'notifications', path: '/fr/notifications' },
  { id: 'settings-messaging', path: '/fr/settings/messaging' },
  { id: 'settings-notifications', path: '/fr/settings/notifications' },
  {
    id: 'unsubscribe',
    path: '/fr/unsubscribe?token=stub-message-token-0001',
    visitor: true,
    act: async (page) => {
      await expect(page.getByText(/Vous ne recevrez plus/)).toBeVisible();
    },
  },
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
          fullPage: true,
        });
        await context.close();
      });
    }
  }
}

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test';
import { PREVIEW_IDS, SCALE, THEMES } from '../../scripts/marketing-previews.mjs';
import { API_ORIGIN, DEMO_PASSWORD } from '../support/fixtures';

/**
 * The sections of the application shown on the public site (docs/design/marketing-captures.md,
 * ADR 0162), captured on the build of the end-to-end tests with the stub api: demonstration data
 * only, never a real person. Reproducible: the clock of the page is frozen, the motion reduced
 * (every element in its final state), the fonts loaded, the network idle, nothing busy.
 */
const ORIGIN = 'http://localhost:3201';
const MEMBER = 'aissatou.ba@demo.pitchorium.test';
const PROJECT = '/fr/projects/ferme-solaire-thies';
const RAW = join(import.meta.dirname, '../../.marketing-raw');

interface Section {
  path: string;
  member: boolean;
  /** The element captured; the screen itself without one. */
  target?: (page: Page) => Locator;
  /** Brings the page to the state captured. */
  act?: (page: Page) => Promise<void>;
  /** Several elements captured together: the box that holds them. */
  around?: (page: Page) => Locator[];
  /** Height kept of the element, over its width: the part the site shows, no more bytes. */
  ratio?: number;
}

const SECTIONS: Record<(typeof PREVIEW_IDS)[number], Section> = {
  // The funding block of a project: amounts, bar, milestones and actions.
  funding: {
    path: PROJECT,
    member: false,
    target: (page) => page.getByRole('complementary', { name: 'Financement et actions' }),
    // Its amounts, its bar and its first milestones: the site crops it at 3:4 at most.
    ratio: 4 / 3,
  },
  // The page of a project, its first screen.
  'project-page': { path: PROJECT, member: false },
  // People suggested with the reason of each suggestion.
  suggestion: {
    path: '/fr/feed',
    member: true,
    target: (page) =>
      page
        .locator('[data-card]')
        .filter({ has: page.getByRole('heading', { name: 'Personnes pertinentes pour vous' }) }),
  },
  // A conversation and the list of conversations.
  conversation: {
    path: '/fr/messages/0192f4a0-6000-7000-8000-000000000001',
    member: true,
    target: (page) => page.getByRole('complementary', { name: 'Conversations' }).locator('..'),
    act: async (page) => {
      await expect(page.getByRole('textbox', { name: 'Votre message' })).toBeVisible();
    },
  },
  // A notification that gathers the reactions of several people.
  notification: {
    path: '/fr/notifications',
    member: true,
    target: (page) => page.getByRole('listitem').filter({ hasText: 'et 12 autres' }).first(),
  },
  // The engagement dashboard: key figures and the months of giving.
  dashboard: {
    path: '/fr/dashboard',
    member: true,
    around: (page) => [
      page.getByTestId('engagement-stats'),
      page.getByRole('region', { name: 'Euros versés sur douze mois' }),
    ],
  },
};

async function settled(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  await expect(page.locator('main [data-loading]')).toHaveCount(0);
  await page.evaluate(async () => {
    for (const image of document.querySelectorAll('img')) image.loading = 'eager';
    await Promise.all(
      [...document.images].map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => (image.onload = image.onerror = resolve)),
      ),
    );
  });
}

async function signIn(context: BrowserContext): Promise<void> {
  const response = await context.request.post(`${API_ORIGIN}/v1/auth/sign-in/email`, {
    data: { email: MEMBER, password: DEMO_PASSWORD },
  });
  expect(response.ok()).toBe(true);
}

mkdirSync(RAW, { recursive: true });

for (const id of PREVIEW_IDS) {
  for (const theme of THEMES) {
    test(`${id} ${theme}`, async ({ browser }) => {
      const section = SECTIONS[id]!;
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: SCALE,
        colorScheme: theme,
        reducedMotion: 'reduce',
        locale: 'fr-FR',
        timezoneId: 'Africa/Dakar',
      });
      if (section.member) await signIn(context);
      const page = await context.newPage();
      // The clock of the page is fixed at the opening: every date and every « il y a » reads
      // the same moment, the times of the stub being set from it.
      await page.clock.setFixedTime(Date.now());
      await page.goto(`${ORIGIN}${section.path}`);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached();
      await section.act?.(page);
      await settled(page);
      const path = join(RAW, `${id}-${theme}.png`);
      if (section.around) {
        // At the top of the page, the boxes of the screen are those of the page.
        await page.evaluate(() => window.scrollTo(0, 0));
        const boxes = await Promise.all(
          section.around(page).map(async (element) => (await element.boundingBox())!),
        );
        const x = Math.min(...boxes.map((box) => box.x));
        const y = Math.min(...boxes.map((box) => box.y));
        const right = Math.max(...boxes.map((box) => box.x + box.width));
        const bottom = Math.max(...boxes.map((box) => box.y + box.height));
        await page.screenshot({
          path,
          animations: 'disabled',
          fullPage: true,
          clip: { x, y, width: right - x, height: bottom - y },
        });
      } else if (section.target) {
        const target = section.target(page);
        await target.scrollIntoViewIfNeeded();
        const box = section.ratio ? await target.boundingBox() : null;
        if (box && section.ratio) {
          await page.screenshot({
            path,
            animations: 'disabled',
            clip: { ...box, height: Math.min(box.height, Math.round(box.width * section.ratio)) },
          });
        } else {
          await target.screenshot({ path, animations: 'disabled' });
        }
      } else {
        await page.screenshot({ path, animations: 'disabled' });
      }
      await context.close();
    });
  }
}

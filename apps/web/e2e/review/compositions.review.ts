import { expect, test } from '@playwright/test';
import { layoutProblems } from './layout-guard';

/** The compositions of Storybook (src/stories/compositions), by their story id. */
const COMPOSITIONS = [
  'member-shell-loading',
  'member-shell-loaded',
  'profile-card-story',
  'project-card-story',
  'notifications-list',
  'conversation',
  'form-with-server-errors',
  'admin-table',
  'auth-sign-in',
  'auth-two-factor',
  'onboarding-profile',
  'settings-security',
  'relationship-actions-story',
  'connect-dialog-story',
  'organization-members',
  'feed-variants',
  'composer-empty',
  'composer-full',
  'post-page',
  'reaction-picker',
  'image-viewer',
  'post-statistics',
];

/** Compositions that show a loading state on purpose. */
const LOADING_STATES = new Set(['member-shell-loading']);

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const id of COMPOSITIONS) {
  for (const viewport of VIEWPORTS) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${id} ${viewport.name} ${theme}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: theme,
          reducedMotion: 'reduce',
          locale: 'fr-FR',
        });
        const page = await context.newPage();
        await page.goto(
          `/iframe.html?id=compositions--${id}&viewMode=story&globals=theme:${theme}`,
        );
        // The story renders, then its play function (the form fills itself and gets the errors).
        await page.waitForFunction(() => {
          const preview = (
            window as unknown as { __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } } }
          ).__STORYBOOK_PREVIEW__;
          return ['completed', 'finished', 'played'].includes(preview?.currentRender?.phase ?? '');
        });
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('#storybook-root')).not.toBeEmpty();
        // The deferred parts (lazy components, their placeholders) are loaded first.
        await page.waitForLoadState('networkidle');
        // (except the composition of the loading state itself).
        if (!LOADING_STATES.has(id)) {
          await expect(page.locator('#storybook-root [aria-busy="true"]')).toHaveCount(0);
          await expect(page.locator('#storybook-root [data-loading]')).toHaveCount(0);
        }
        // The whole document: a dialog or a popover of the story is portalled out of its root.
        const problems = await layoutProblems(page, 'body');
        expect(problems).toEqual([]);
        // Written by review:captures, compared by review:check (playwright.review.config.ts), once
        // two consecutive screenshots are equal (the virtualized feed measures its entries).
        await expect(page).toHaveScreenshot(`${id}-${viewport.name}-${theme}.png`, {
          fullPage: true,
        });
        await context.close();
      });
    }
  }
}

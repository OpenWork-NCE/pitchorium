import { join } from 'node:path';
import { expect, test } from '@playwright/test';

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
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

const OUTPUT = join(import.meta.dirname, '../../../../docs/design/review');

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
        // Nothing goes past the edge of the story, on a phone either, unless a container scrolls or
        // clips it (a wide table scrolls in its own frame).
        const overflowing = await page.evaluate(() => {
          const root = document.querySelector('#storybook-root')!;
          const edge = root.getBoundingClientRect().right + 0.5;
          const contained = (element: Element) => {
            for (
              let parent = element.parentElement;
              parent && parent !== root;
              parent = parent.parentElement
            ) {
              if (getComputedStyle(parent).overflowX !== 'visible') return true;
            }
            return false;
          };
          return [...root.querySelectorAll('*')]
            .filter(
              (element) => element.getBoundingClientRect().right > edge && !contained(element),
            )
            .map(
              (element) =>
                `${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''}`,
            );
        });
        expect(overflowing).toEqual([]);
        await page.screenshot({
          path: join(OUTPUT, `${id}-${viewport.name}-${theme}.png`),
          fullPage: true,
        });
        await context.close();
      });
    }
  }
}

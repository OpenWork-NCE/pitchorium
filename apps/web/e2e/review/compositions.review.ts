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

/** How a story ended, read by the review (`window.__reviewStory`). */
type StoryOutcome = { error?: string; accessibility: string[] };

/**
 * Records how the story ended in `window.__reviewStory`, from the channel of the preview listened
 * to from its creation. A render or a play function that throws still ends in the phase
 * `finished`, and its status stays `success`: only its own event tells it. The violations of the
 * accessibility checks are set apart: those of the stories are gated by `test:stories` (at
 * 1280x800), the review reports the ones of its other sizes.
 */
function listenToStoryFinished() {
  type Payload = {
    status?: string;
    message?: string;
    title?: string;
    reporters?: { type: string; status: string; result: unknown }[];
  };
  type Channel = { on: (event: string, listener: (payload?: Payload) => void) => void };
  const target = window as unknown as { __reviewStory?: StoryOutcome };
  let error: string | undefined;
  let channel: Channel | undefined;
  Object.defineProperty(window, '__STORYBOOK_ADDONS_CHANNEL__', {
    configurable: true,
    get: () => channel,
    set: (value: Channel) => {
      channel = value;
      for (const event of ['playFunctionThrewException', 'storyThrewException', 'storyErrored']) {
        value.on(event, (payload) => {
          error ??= `${event}: ${(payload?.message ?? payload?.title ?? '').split('\n')[0]}`;
        });
      }
      value.on('storyFinished', (payload) => {
        const failed = (payload?.reporters ?? []).filter((report) => report.status === 'failed');
        const accessibility = failed
          .filter((report) => report.type === 'a11y')
          .flatMap(
            (report) =>
              (
                report.result as {
                  violations?: { id: string; nodes: { target: unknown[] }[] }[];
                }
              ).violations ?? [],
          )
          .map(
            (violation) =>
              `${violation.id}: ${JSON.stringify(violation.nodes.map((node) => node.target))}`,
          );
        const other = failed.find((report) => report.type !== 'a11y');
        // An unhandled error of the story: the status says so, no report does.
        const unhandled = payload?.status === 'error' && failed.length === 0;
        error ??= other
          ? `${other.type}: ${JSON.stringify(other.result).slice(0, 500)}`
          : unhandled
            ? 'an unhandled error'
            : undefined;
        target.__reviewStory = { ...(error ? { error } : {}), accessibility };
      });
    },
  });
}

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
        await page.addInitScript(listenToStoryFinished);
        await page.goto(
          `/iframe.html?id=compositions--${id}&viewMode=story&globals=theme:${theme}`,
        );
        // The story renders, then its play function (the form fills itself and gets the errors).
        // A page half played is never a reference.
        const outcome = (await (
          await page.waitForFunction(
            () => (window as unknown as { __reviewStory?: StoryOutcome }).__reviewStory,
          )
        ).jsonValue()) as StoryOutcome;
        expect(outcome.error, 'the story and its play function succeed').toBeUndefined();
        for (const violation of outcome.accessibility) {
          test.info().annotations.push({ type: 'accessibility', description: violation });
        }
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

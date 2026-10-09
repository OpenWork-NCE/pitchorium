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
  'auth-sign-in',
  'auth-two-factor',
  'onboarding-profile',
  'settings-security',
  'relationship-actions-story',
  'connect-dialog-story',
  'organization-members',
];

/** Compositions that show a loading state on purpose. */
const LOADING_STATES = new Set(['member-shell-loading']);

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
        // The deferred parts (lazy components, their placeholders) are loaded first.
        await page.waitForLoadState('networkidle');
        // (except the composition of the loading state itself).
        if (!LOADING_STATES.has(id)) {
          await expect(page.locator('#storybook-root [aria-busy="true"]')).toHaveCount(0);
          await expect(page.locator('#storybook-root [data-loading]')).toHaveCount(0);
        }
        const problems = await page.evaluate(() => {
          const root = document.querySelector('#storybook-root')!;
          const frame = root.getBoundingClientRect();
          const name = (element: Element) =>
            `${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''}`;
          const visible = (element: Element) => {
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            // Text for screen readers only (1 px, clipped) is not on the screen.
            return (
              box.width > 1 &&
              box.height > 1 &&
              style.visibility !== 'hidden' &&
              style.clipPath !== 'inset(50%)' &&
              style.clip === 'auto'
            );
          };
          const clipped = (element: Element, until: Element) => {
            for (
              let parent = element.parentElement;
              parent && parent !== until;
              parent = parent.parentElement
            ) {
              const style = getComputedStyle(parent);
              if (style.overflowX !== 'visible' || style.overflowY !== 'visible') return true;
            }
            return false;
          };
          const elements = [...root.querySelectorAll('*')].filter(visible);
          // 1. Nothing goes past any of the four edges of the story, unless a container scrolls
          // or clips it (a wide table scrolls in its own frame).
          const outside = elements
            .filter((element) => {
              const box = element.getBoundingClientRect();
              return (
                (box.left < frame.left - 0.5 ||
                  box.top < frame.top - 0.5 ||
                  box.right > frame.right + 0.5 ||
                  box.bottom > frame.bottom + 0.5) &&
                !clipped(element, root)
              );
            })
            .map((element) => `edge: ${name(element)}`);
          // 1b. Nothing is cut by a container that hides its overflow without scrolling (a panel,
          // a card), except images cropped on purpose and texts truncated on purpose.
          const truncated = (element: Element) => {
            for (
              let node: Element | null = element;
              node && node !== root;
              node = node.parentElement
            ) {
              const style = getComputedStyle(node);
              if (style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none')
                return true;
            }
            return false;
          };
          const cut = elements
            .filter((element) => {
              if (['IMG', 'VIDEO', 'svg', 'path', 'circle', 'g'].includes(element.tagName)) {
                return false;
              }
              const style = getComputedStyle(element);
              // Positioned or moved on purpose (the indicator of a progress bar slides in its
              // track), or truncated on purpose.
              if (style.position === 'absolute' || style.position === 'fixed') return false;
              if (style.transform !== 'none' || truncated(element)) return false;
              for (
                let parent = element.parentElement;
                parent && parent !== root;
                parent = parent.parentElement
              ) {
                const style = getComputedStyle(parent);
                if (style.overflowX === 'auto' || style.overflowX === 'scroll') return false;
                if (style.overflowX === 'hidden' || style.overflowX === 'clip') {
                  const own = element.getBoundingClientRect();
                  const frame = parent.getBoundingClientRect();
                  return own.right > frame.right + 0.5 || own.left < frame.left - 0.5;
                }
              }
              return false;
            })
            .map((element) => `cut: ${name(element)}`);
          // 2. One logo per screen: the marks of the brand, and the backgrounds of the kit that
          // carry their own logotype (the discreet backgrounds).
          const marks = elements.filter((element) => element.hasAttribute('data-brand-mark'));
          const logoBackgrounds = [root, ...root.querySelectorAll('*')].filter((element) =>
            /-discreet\.svg/.test(getComputedStyle(element).backgroundImage),
          );
          const logos =
            marks.length + logoBackgrounds.length > 1
              ? [
                  `logos: ${marks.length} mark(s), ${logoBackgrounds.length} background(s) with a logotype`,
                ]
              : [];
          // 3. Nothing in a card touches its border: at least 8 px of its padding stay free (all
          // of it when the padding is smaller, none for a card without padding).
          const touching = [...root.querySelectorAll('[data-card]')].flatMap((card) => {
            const box = card.getBoundingClientRect();
            const style = getComputedStyle(card);
            const free = (padding: string) => Math.min(parseFloat(padding), 8);
            const inner = {
              left: box.left + parseFloat(style.borderLeftWidth) + free(style.paddingLeft),
              right: box.right - parseFloat(style.borderRightWidth) - free(style.paddingRight),
              top: box.top + parseFloat(style.borderTopWidth) + free(style.paddingTop),
              bottom: box.bottom - parseFloat(style.borderBottomWidth) - free(style.paddingBottom),
            };
            return [...card.querySelectorAll('*')]
              .filter(visible)
              .filter((element) => {
                if (clipped(element, card)) return false;
                const position = getComputedStyle(element).position;
                return position !== 'absolute' && position !== 'fixed';
              })
              .flatMap((element) => {
                const own = element.getBoundingClientRect();
                const sides = [
                  ['left', own.left - inner.left],
                  ['right', inner.right - own.right],
                  ['top', own.top - inner.top],
                  ['bottom', inner.bottom - own.bottom],
                ].filter(([, gap]) => (gap as number) < -0.5);
                return sides.length > 0
                  ? [
                      `card: ${name(element)} (${sides
                        .map(([side, gap]) => `${side} ${Math.round((gap as number) * 10) / 10}px`)
                        .join(', ')})`,
                    ]
                  : [];
              });
          });
          return [...outside, ...cut, ...logos, ...touching];
        });
        expect(problems).toEqual([]);
        await page.screenshot({
          path: join(OUTPUT, `${id}-${viewport.name}-${theme}.png`),
          fullPage: true,
        });
        await context.close();
      });
    }
  }
}

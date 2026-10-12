import { appendFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { hideFixedBars } from '../support/full-page';
import { allowConsole, API_ORIGIN, DEMO_PASSWORD, expect, test } from '../support/fixtures';
import { layoutProblems } from '../review/layout-guard';
import { type Screen, SCREENS } from './screens';

/**
 * Audit of every screen (PROMPT FRONT 9B): axe in both themes (B2), the layout guard of the review
 * captures in both sizes (B6) and the long labels of French and English on a phone (B1). With
 * AUDIT_PSEUDO=1 (playwright.audit.config.ts serves the pages pseudo-localized), each screen is
 * also read for a text written outside the catalogues and for what a 40 % longer text breaks.
 * AUDIT_CAPTURES=<dir> writes a capture of each screen there, for the review of the direction
 * (docs/design/direction.md); AUDIT_REPORT=<dir> writes what the pseudo-locale left unframed, to
 * read (the api data, and a text written outside the catalogues), and what its longer texts break.
 */
const PSEUDO = process.env.AUDIT_PSEUDO === '1';
const CAPTURES = process.env.AUDIT_CAPTURES;
const REPORT = process.env.AUDIT_REPORT;

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

type Viewport = keyof typeof VIEWPORTS;
type Theme = 'light' | 'dark';

interface Variant {
  locale: 'fr' | 'en';
  viewport: Viewport;
  theme: Theme;
}

/** French in both sizes and both themes; English on a phone, where its labels run long. */
const VARIANTS: Variant[] = PSEUDO
  ? [
      { locale: 'fr', viewport: 'desktop', theme: 'light' },
      { locale: 'fr', viewport: 'mobile', theme: 'light' },
    ]
  : [
      { locale: 'fr', viewport: 'desktop', theme: 'light' },
      { locale: 'fr', viewport: 'desktop', theme: 'dark' },
      { locale: 'fr', viewport: 'mobile', theme: 'light' },
      { locale: 'fr', viewport: 'mobile', theme: 'dark' },
      { locale: 'en', viewport: 'mobile', theme: 'light' },
    ];

/** Folders of the pages of `src/app/[locale]`, as SCREENS names them. */
function pageRoutes(directory = join(import.meta.dirname, '../../src/app/[locale]')): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return pageRoutes(path);
    if (entry.name !== 'page.tsx') return [];
    return [
      relative(join(import.meta.dirname, '../../src/app/[locale]'), directory) || '(marketing)',
    ];
  });
}

test('lists every page of the app', () => {
  const listed = new Set(SCREENS.map((screen) => screen.route));
  expect(pageRoutes().filter((route) => !listed.has(route))).toEqual([]);
  expect([...listed].filter((route) => !pageRoutes().includes(route))).toEqual([]);
});

/** The page complete: fonts, deferred parts and images loaded on approach. */
async function settle(page: Page): Promise<void> {
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

interface Unframed {
  /**
   * Codes of the api shown as text (`campaign_in_funding`): a code is said through the
   * catalogues (`reference`), outside a technical value set in monospace (`code`, `font-mono`).
   */
  codes: string[];
  /** A title of the page that the catalogues did not write (its frame), the brand aside. */
  title: string[];
  /** Controls, labels and attributes without a frame: the api data they hold, or a text to read. */
  interface: string[];
  /** Other texts without a frame: the content of the api, or a text to read. */
  other: string[];
}

/**
 * Texts the pseudo-locale did not frame. A text is framed when an element around it holds an
 * opening bracket before it and a closing one after it (a message with a rich tag spans several
 * nodes). Plain runs of three letters or more only: numbers, dates and codes are formatted, not
 * written.
 */
async function unframedTexts(page: Page): Promise<Unframed> {
  return page.evaluate(() => {
    const PLAIN = /[A-Za-z]{3,}/;
    const CONTROLS =
      'button, label, legend, th, summary, option, [role="tab"], [role="menuitem"], [role="option"], [role="radio"], [role="switch"]';
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden';
    };
    const framed = (node: Node) => {
      let element = node.parentElement;
      for (let depth = 0; element && depth < 8; depth += 1, element = element.parentElement) {
        const text = element.textContent ?? '';
        const range = document.createRange();
        range.selectNodeContents(element);
        range.setEnd(node, 0);
        const offset = range.toString().length;
        const before = text.slice(0, offset);
        const after = text.slice(offset + (node.textContent ?? '').length);
        if (before.lastIndexOf('[') > before.lastIndexOf(']') && after.includes(']')) return true;
      }
      return false;
    };
    const CODE = /^[a-z]+(?:_[a-z0-9]+)+$/;
    const result = {
      codes: [] as string[],
      title: [] as string[],
      interface: [] as string[],
      other: [] as string[],
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? '';
      const parent = node.parentElement;
      if (!parent || !PLAIN.test(text) || text.includes('[')) continue;
      if (parent.closest('script, style, noscript, svg, [aria-hidden="true"]')) continue;
      if (!visible(parent) || framed(node)) continue;
      if (CODE.test(text) && !parent.closest('code, kbd, .font-mono')) result.codes.push(text);
      (parent.closest(CONTROLS) ? result.interface : result.other).push(text.slice(0, 80));
    }
    for (const element of document.querySelectorAll(
      '[aria-label], [placeholder], [title], [aria-description]',
    )) {
      for (const name of ['aria-label', 'placeholder', 'title', 'aria-description']) {
        const value = element.getAttribute(name);
        if (value && PLAIN.test(value) && !value.includes('[')) {
          result.interface.push(`@${name}: ${value.slice(0, 80)}`);
        }
      }
    }
    // « <resource> | Pitchorium » joins the name of a resource of the api to the brand.
    if (!document.title.includes('[') && !/(^| \| )Pitchorium$/.test(document.title)) {
      result.title.push(document.title);
    }
    return result;
  });
}

async function open(page: Page, screen: Screen, locale: string): Promise<void> {
  if (screen.notFound) allowConsole(/status of 404 \(Not Found\)/);
  if (screen.as) {
    const response = await page.request.post(`${API_ORIGIN}/v1/auth/sign-in/email`, {
      data: { email: screen.as, password: DEMO_PASSWORD },
    });
    expect(response.ok()).toBe(true);
  }
  const response = await page.goto(`/${locale}${screen.path}`);
  expect(response?.status()).toBe(screen.notFound ? 404 : 200);
  await settle(page);
}

for (const screen of SCREENS) {
  for (const variant of VARIANTS) {
    const name = `${screen.id}-${variant.locale}-${variant.viewport}-${variant.theme}`;
    test(name, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: VIEWPORTS[variant.viewport],
        colorScheme: variant.theme,
        reducedMotion: 'reduce',
        locale: variant.locale === 'fr' ? 'fr-FR' : 'en-GB',
      });
      const page = await context.newPage();
      await open(page, screen, variant.locale);

      if (PSEUDO) {
        const unframed = await unframedTexts(page);
        if (REPORT) {
          mkdirSync(REPORT, { recursive: true });
          appendFileSync(
            join(REPORT, 'unframed.jsonl'),
            `${JSON.stringify({ name, ...unframed })}\n`,
          );
        }
        expect({ codes: unframed.codes, title: unframed.title }).toEqual({ codes: [], title: [] });
      } else if (variant.locale === 'fr' && variant.viewport === 'desktop') {
        // axe in both themes (contrast), on the layout of a computer.
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map(({ id, nodes }) => `${id}: ${nodes.length}`)).toEqual([]);
      }

      await hideFixedBars(page);
      // Captured before the guard judges it: a screen that fails is reviewed as it is.
      if (CAPTURES) {
        await page.screenshot({
          path: join(CAPTURES, `${name}.png`),
          fullPage: true,
          animations: 'disabled',
        });
      }
      const problems = await layoutProblems(page, 'body');
      if (PSEUDO) {
        // With texts 40 % longer than French, the headers of the public site and of the console
        // do not collapse their navigation yet (question 148): written to the report, to read
        // before a longer language is activated, not a failure.
        if (REPORT) {
          appendFileSync(join(REPORT, 'layout.jsonl'), `${JSON.stringify({ name, problems })}\n`);
        }
      } else {
        expect(problems).toEqual([]);
      }
      await context.close();
    });
  }
}

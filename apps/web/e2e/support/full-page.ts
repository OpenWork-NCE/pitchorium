import type { Page } from '@playwright/test';

/**
 * Before a page is shot whole: an element fixed to the screen would be drawn once, in the middle
 * of the long image. The action bar of a project page on a phone is hidden here and shot apart, in
 * its real screen (e2e/review/pages.review.ts). Set through the style of the element (CSSOM),
 * which the Content Security Policy of the page allows, never by an injected stylesheet.
 */
export async function hideFixedBars(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const bar of document.querySelectorAll<HTMLElement>('[data-action-bar]')) {
      bar.style.visibility = 'hidden';
    }
  });
}

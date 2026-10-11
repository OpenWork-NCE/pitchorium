import type { Page } from '@playwright/test';

/**
 * Before a page is shot whole: an element fixed to the screen would be drawn once, in the middle
 * of the long image. The action bar of a project page on a phone is hidden here and shot apart, in
 * its real screen (e2e/review/pages.review.ts); the footer pinned under an editorial page (H29,
 * `footer-uncover`) goes back to the end of the document, where the reader uncovers it. Set
 * through the style of the elements (CSSOM), which the Content Security Policy of the page
 * allows, never by an injected stylesheet.
 */
export async function hideFixedBars(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const bar of document.querySelectorAll<HTMLElement>('[data-action-bar]')) {
      bar.style.visibility = 'hidden';
    }
    for (const footer of document.querySelectorAll<HTMLElement>('.footer-uncover')) {
      footer.style.position = 'static';
    }
  });
}

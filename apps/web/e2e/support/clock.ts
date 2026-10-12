import { test as base, type Browser, type BrowserContext } from '@playwright/test';
import { stubNow } from './stub-clock.mjs';

/**
 * The browser on the clock of the stub api (ADR 0171): every context a test opens, the default
 * one and those of `browser.newContext()`, starts at the date the stub and the server of the pages
 * read, and flows with the real time (timers stay real).
 */
export async function stubClock(
  { context, browser }: { context: BrowserContext; browser: Browser },
  provide: () => Promise<void>,
): Promise<void> {
  await context.clock.setSystemTime(stubNow());
  const original = browser.newContext.bind(browser);
  browser.newContext = async (options) => {
    const opened = await original(options);
    await opened.clock.setSystemTime(stubNow());
    return opened;
  };
  try {
    await provide();
  } finally {
    browser.newContext = original;
  }
}

/** `test` of Playwright with the browser on the clock of the stub (the review captures). */
export const test = base.extend<{ stubClock: void }>({ stubClock: [stubClock, { auto: true }] });

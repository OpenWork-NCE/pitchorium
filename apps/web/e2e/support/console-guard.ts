import { type Browser, type BrowserContext, test as base } from '@playwright/test';

/**
 * A journey fails on any error of the browser (A2 of the PROMPT FRONT 4): an error written to the
 * console, a warning of React about the hydration, an uncaught exception, a rejected promise
 * nobody handled, a violation of the Content Security Policy. Every context a test opens is
 * watched (the default one and those of `browser.newContext()`), every page in it, from its first
 * script. A journey that provokes an error on purpose declares it (`allowConsole`).
 */

/** Warnings of React and Next.js about a server render the browser does not match. */
const HYDRATION = /hydrat|did not match|server rendered (HTML|text)|Expected server HTML/i;

/** Patterns the current test declared as expected, cleared after each test. */
let allowed: RegExp[] = [];

/** Declares errors the journey provokes on purpose (a 404 it opens, a refusal it checks). */
export function allowConsole(...patterns: RegExp[]): void {
  allowed.push(...patterns);
}

/** Problems only the page sees, reported to the test from its first script. */
function reportFromPage() {
  const report = (window as unknown as { reportBrowserProblem: (text: string) => void })
    .reportBrowserProblem;
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    report(
      `unhandled rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`,
    );
  });
  document.addEventListener('securitypolicyviolation', (event) => {
    report(
      `CSP violation: ${event.effectiveDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`,
    );
  });
}

async function watch(context: BrowserContext, problems: string[]): Promise<void> {
  await context.exposeBinding('reportBrowserProblem', (_source, text: string) => {
    problems.push(text);
  });
  await context.addInitScript(reportFromPage);
  context.on('console', (message) => {
    const text = message.text();
    const location = message.location();
    const at = location.url ? ` (${location.url}:${location.lineNumber})` : '';
    // Firefox reports a font download that a navigation aborted (NS_BINDING_ABORTED).
    if (/downloadable font: download failed .*status=2152398850/.test(text)) return;
    // The script of Cloudflare Turnstile, in its own frame, posts to its origin before the frame
    // has loaded it (Firefox and WebKit say so): a message of the widget, not of the page.
    if (
      /(Failed to execute ‘postMessage’|Unable to post message to) .*challenges\.cloudflare\.com/.test(
        text,
      )
    ) {
      return;
    }
    if (message.type() === 'error' || HYDRATION.test(text)) {
      problems.push(`console.${message.type()}: ${text}${at}`);
    }
  });
  context.on('weberror', (error) => {
    const message = `${error.error().stack ?? ''} ${error.error().message}`;
    // WebKit rejects a request that a navigation cancels (a page of the router, a call of the
    // api still running) with « access control checks », even of the same origin: not a failure.
    // A real refusal of CORS is caught by Chromium and Firefox, which say it otherwise.
    if (/Fetch API cannot load \S+ due to access control checks/.test(message)) return;
    problems.push(`uncaught: ${error.error().stack ?? error.error().message}`);
  });
}

/** The test of Playwright with the guard: an automatic fixture around every test. */
export const guardedTest = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ context, browser }, provide, testInfo) => {
      const problems: string[] = [];
      allowed = [];
      await watch(context, problems);
      // Contexts the journey opens itself (two members side by side) are watched too.
      const original = browser.newContext.bind(browser);
      const patched: Browser['newContext'] = async (options) => {
        const opened = await original(options);
        await watch(opened, problems);
        return opened;
      };
      browser.newContext = patched;
      try {
        await provide();
      } finally {
        browser.newContext = original;
      }
      const unexpected = problems.filter(
        (problem) => !allowed.some((pattern) => pattern.test(problem)),
      );
      if (unexpected.length > 0 && testInfo.status === testInfo.expectedStatus) {
        throw new Error(
          `The browser reported ${unexpected.length} error(s):\n${unexpected.join('\n')}`,
        );
      }
    },
    { auto: true },
  ],
});

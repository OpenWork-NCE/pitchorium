import { type APIRequestContext, expect, type Page } from '@playwright/test';
import { guardedTest } from './console-guard';

export { allowConsole } from './console-guard';

/**
 * Violations of the Content Security Policy reported by the page, collected from the start; any
 * error of the browser fails the journey (console-guard.ts).
 */
export const test = guardedTest.extend<{ cspViolations: string[] }>({
  cspViolations: async ({ page }, provide) => {
    const violations: string[] = [];
    await page.exposeFunction('reportCspViolation', (entry: string) => violations.push(entry));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        void (
          window as unknown as { reportCspViolation: (entry: string) => Promise<void> }
        ).reportCspViolation(
          `${event.violatedDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}:${event.columnNumber}`,
        );
      });
    });
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
        violations.push(message.text());
      }
    });
    await provide(violations);
  },
});

export { expect };

/** Origin of the stub api (playwright.config.ts). */
export const API_ORIGIN = 'http://localhost:3299';

/** Password of the demonstration accounts (`pnpm db:seed:dev`, frontend handoff). */
export const DEMO_PASSWORD = 'pitchorium-demo-2026';

/**
 * Opens a session through the api with a demonstration account, as the sign-in page will
 * (PROMPT FRONT 2): the session cookie lands in the context of the page.
 */
export async function signIn(page: Page, email: string): Promise<void> {
  const response = await page.request.post(`${API_ORIGIN}/v1/auth/sign-in/email`, {
    data: { email, password: DEMO_PASSWORD },
  });
  expect(response.ok()).toBe(true);
}

/** Test routes of the stub: realtime events, log of the writes, reset. */
export function stub(request: APIRequestContext) {
  return {
    emit: (event: string, payload: unknown) =>
      request.post(`${API_ORIGIN}/__test/emit`, { data: { event, payload } }),
    writes: async () =>
      (await (await request.get(`${API_ORIGIN}/__test/writes`)).json()) as {
        route: string;
        key: string | null;
        replay: boolean;
      }[],
    reset: () => request.post(`${API_ORIGIN}/__test/reset`),
  };
}

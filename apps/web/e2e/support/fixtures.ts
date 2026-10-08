import { test as base, expect } from '@playwright/test';

/** Violations of the Content Security Policy reported by the page, collected from the start. */
export const test = base.extend<{ cspViolations: string[] }>({
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

import { expect, test } from '@playwright/test';
import { API_ORIGIN, DEMO_PASSWORD } from '../support/fixtures';

/**
 * Pages of the projects and of the impact (PROMPT FRONT 5A), server components out of reach of
 * Storybook: captured on the build of the end-to-end tests served with the stub api
 * (e2e/support/serve.mjs, port 3201), in both themes and both sizes (docs/design/review).
 */
const ORIGIN = 'http://localhost:3201';
const MEMBER = 'aissatou.ba@demo.pitchorium.test';
const DRAFT = '/fr/projects/projet-en-preparation';
const STEPS = [
  'essentials',
  'story',
  'media',
  'funding',
  'rewards',
  'instruments',
  'impact',
  'team',
  'preview',
  'publish',
];

const PAGES: { id: string; path: string; member: boolean }[] = [
  { id: 'showcase', path: '/fr/projects', member: false },
  { id: 'project-visitor', path: '/fr/projects/ferme-solaire-thies', member: false },
  { id: 'project-member', path: '/fr/projects/ferme-solaire-thies', member: true },
  { id: 'project-funded', path: '/fr/projects/cooperative-karite-kaolack', member: false },
  { id: 'project-closed', path: '/fr/projects/sechoirs-mbour', member: false },
  ...STEPS.map((step) => ({ id: `wizard-${step}`, path: `${DRAFT}/edit/${step}`, member: true })),
  { id: 'manage-overview', path: '/fr/projects/ferme-solaire-thies/manage', member: true },
  {
    id: 'manage-interests',
    path: '/fr/projects/ferme-solaire-thies/manage?tab=interests',
    member: true,
  },
  { id: 'methodology', path: '/fr/impact/methodology', member: false },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const page of PAGES) {
  for (const viewport of VIEWPORTS) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${page.id} ${viewport.name} ${theme}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: theme,
          reducedMotion: 'reduce',
          locale: 'fr-FR',
        });
        const tab = await context.newPage();
        if (page.member) {
          const response = await tab.request.post(`${API_ORIGIN}/v1/auth/sign-in/email`, {
            data: { email: MEMBER, password: DEMO_PASSWORD },
          });
          expect(response.ok()).toBe(true);
        }
        await tab.goto(`${ORIGIN}${page.path}`);
        await expect(tab.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await tab.evaluate(() => document.fonts.ready);
        await tab.waitForLoadState('networkidle');
        await expect(tab.locator('main [aria-busy="true"]')).toHaveCount(0);
        await expect(tab.locator('main [data-loading]')).toHaveCount(0);
        // Images loaded on approach: brought into view once, so that the page is complete.
        await tab.evaluate(async () => {
          for (const image of document.querySelectorAll('img')) image.loading = 'eager';
          await Promise.all(
            [...document.images].map((image) =>
              image.complete
                ? Promise.resolve()
                : new Promise((resolve) => (image.onload = image.onerror = resolve)),
            ),
          );
        });
        await expect(tab).toHaveScreenshot(`${page.id}-${viewport.name}-${theme}.png`, {
          fullPage: true,
          // Animations brought to their end state: a stable capture.
          animations: 'disabled',
        });
        await context.close();
      });
    }
  }
}

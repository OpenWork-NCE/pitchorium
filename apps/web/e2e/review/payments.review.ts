import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test';
import { API_ORIGIN, DEMO_PASSWORD } from '../support/fixtures';
import { layoutProblems } from './layout-guard';

/**
 * Screens of the contributions, the payout and the engagement (PROMPT FRONT 5B), on the build of
 * the end-to-end tests served with the stub api (e2e/support/stub-payments.mjs), in both themes
 * and both sizes (docs/design/review). A state of the stub is chosen by a cookie of the context:
 * the captures run in parallel without sharing it.
 */
const ORIGIN = 'http://localhost:3201';
const MEMBER = 'aissatou.ba@demo.pitchorium.test';
const PROJECT = '/fr/projects/ferme-solaire-thies';
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

interface Screen {
  id: string;
  path: string;
  cookies?: Record<string, string>;
  /** Brings the page to the state to capture; returns the region to capture (the page if none). */
  act?: (page: Page, mobile: boolean) => Promise<Locator | null>;
}

const dialog = (page: Page) => page.getByTestId('contribute-dialog');

/** Opens the journey and walks it to `step`, with Senegal (or `country`) and 120 euros. */
async function journeyTo(page: Page, step: string, country = 'Sénégal'): Promise<Locator> {
  await page.getByTestId('contribute-entry').getByRole('button', { name: 'Contribuer' }).click();
  const box = dialog(page);
  await expect(box).toHaveAttribute('data-step', 'kind');
  const next = async () => box.getByRole('button', { name: 'Continuer' }).click();
  const reach = async (name: string) => {
    if ((await box.getAttribute('data-step')) !== name) await next();
    await expect(box).toHaveAttribute('data-step', name);
  };
  if (step === 'kind') return box;
  await box.getByRole('radio', { name: /Crowdfunding avec contrepartie/ }).click();
  await reach('country');
  if (country !== 'Sénégal') {
    await box.getByRole('combobox').click();
    await page.getByRole('option', { name: country }).click();
  }
  if (step === 'country') return box;
  await reach('amount');
  await box.getByRole('textbox', { name: /Montant/ }).fill('120');
  await page.waitForTimeout(700);
  if (step === 'amount') return box;
  await reach('reward');
  // The visit is beyond the amount: its minimum and the adjustment; the postcard is within it.
  await box.getByRole('radio', { name: step === 'reward' ? /Visite/ : /Carte postale/ }).click();
  await page.waitForTimeout(700);
  if (step === 'reward') return box;
  await reach('behalf');
  if (step === 'behalf') return box;
  await reach('display');
  if (step === 'display') return box;
  await reach('method');
  await page.waitForTimeout(700);
  if (step === 'method') return box;
  await box.getByRole('radio').first().click();
  await reach('review');
  await expect(box.getByTestId('quote-summary')).toBeVisible();
  return box;
}

const aside = (page: Page, mobile: boolean) =>
  mobile
    ? page.getByTestId('contribute-entry')
    : page.getByRole('complementary', { name: /Financement/ });

const SCREENS: Screen[] = [
  ...(
    [
      'open',
      'holder_not_verified',
      'holder_without_covered_payout_account',
      'funding_frozen',
      'campaign_closed',
    ] as const
  ).map((state): Screen => ({
    id: `availability-${state.replaceAll('_', '-')}`,
    path: PROJECT,
    cookies: { stub_availability: state },
    act: async (page, mobile) => {
      await expect(page.getByTestId('contribute-entry')).toBeVisible();
      return aside(page, mobile);
    },
  })),
  {
    id: 'availability-resume',
    path: PROJECT,
    cookies: { stub_pending: '1' },
    act: async (page, mobile) => {
      await expect(page.getByRole('button', { name: 'Reprendre le paiement' })).toBeVisible();
      return aside(page, mobile);
    },
  },
  ...['kind', 'country', 'amount', 'reward', 'behalf', 'display', 'review'].map((step): Screen => ({
    id: `journey-${step}`,
    path: PROJECT,
    act: async (page) => {
      const box = await journeyTo(page, step);
      return box;
    },
  })),
  {
    // From France, mobile money is not offered: the reason, then what is accepted.
    id: 'journey-method-unavailable',
    path: PROJECT,
    act: async (page) => {
      const box = await journeyTo(page, 'method', 'France');
      await expect(box.getByTestId('unavailable-methods')).toBeVisible();
      return box;
    },
  },
  { id: 'return-pending', path: '/fr/contributions/0192f4a0-5000-7000-8000-000000000001/return' },
  { id: 'return-paid', path: '/fr/contributions/0192f4a0-5000-7000-8000-000000000002/return' },
  { id: 'return-unpaid', path: '/fr/contributions/0192f4a0-5000-7000-8000-000000000003/return' },
  { id: 'contribution-detail', path: '/fr/contributions/0192f4a0-5000-7000-8000-000000000005' },
  {
    id: 'contribution-lock-expired',
    path: '/fr/contributions/0192f4a0-5000-7000-8000-000000000004',
  },
  { id: 'manage-contributions', path: `${PROJECT}/manage?tab=contributions` },
  { id: 'manage-offline', path: `${PROJECT}/manage?tab=offline` },
  { id: 'manage-supporters', path: `${PROJECT}/manage?tab=supporters` },
  {
    id: 'manage-collection-banner',
    path: `${PROJECT}/manage`,
    cookies: { stub_availability: 'holder_not_verified' },
  },
  {
    id: 'payouts-choice',
    path: '/fr/settings/payouts',
    cookies: { stub_payout: 'none' },
    act: async (page) => {
      const choice = page.getByTestId('payout-choice');
      await choice.getByRole('combobox').click();
      await page.getByRole('option', { name: 'France' }).click();
      await expect(choice.getByTestId('payout-option')).toBeVisible();
      // The content only: the choice scrolls the page under its fixed header.
      return page.locator('main');
    },
  },
  {
    id: 'payouts-uncovered',
    path: '/fr/settings/payouts',
    cookies: { stub_payout: 'none' },
    act: async (page) => {
      const choice = page.getByTestId('payout-choice');
      await choice.getByRole('combobox').click();
      await page.getByRole('option', { name: 'Sénégal' }).click();
      await expect(choice.getByText(/Aucune option couverte/)).toBeVisible();
      return page.locator('main');
    },
  },
  { id: 'payouts-account', path: '/fr/settings/payouts', cookies: { stub_payout: 'pending' } },
  {
    id: 'payouts-kyc-rejected',
    path: '/fr/settings/payouts',
    cookies: { stub_payout: 'rejected' },
  },
  { id: 'dashboard', path: '/fr/dashboard' },
  { id: 'time-log', path: '/fr/dashboard/time' },
];

async function signedIn(context: BrowserContext, cookies: Record<string, string> = {}) {
  const tab = await context.newPage();
  const response = await tab.request.post(`${API_ORIGIN}/v1/auth/sign-in/email`, {
    data: { email: MEMBER, password: DEMO_PASSWORD },
  });
  expect(response.ok()).toBe(true);
  await context.addCookies(
    Object.entries(cookies).map(([name, value]) => ({
      name,
      value,
      domain: 'localhost',
      path: '/',
    })),
  );
  return tab;
}

for (const screen of SCREENS) {
  for (const viewport of VIEWPORTS) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${screen.id} ${viewport.name} ${theme}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: theme,
          reducedMotion: 'reduce',
          locale: 'fr-FR',
        });
        const tab = await signedIn(context, screen.cookies);
        await tab.goto(`${ORIGIN}${screen.path}`);
        await expect(tab.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await tab.evaluate(() => document.fonts.ready);
        await tab.waitForLoadState('networkidle');
        const region = screen.act ? await screen.act(tab, viewport.name === 'mobile') : null;
        await expect(tab.locator('main [aria-busy="true"]:not([data-outcome])')).toHaveCount(0);
        await expect(tab.locator('main [data-loading]')).toHaveCount(0);
        expect(await layoutProblems(tab, 'body')).toEqual([]);
        const name = `${screen.id}-${viewport.name}-${theme}.png`;
        const options = { animations: 'disabled' as const };
        const box = region ? await region.boundingBox() : null;
        if (region && box && box.height > viewport.height) {
          // A region taller than the screen would be captured while scrolling: the sticky header
          // and a focused skip link would land on it at a different place each time. The whole
          // page fits the screen instead, from its top, without focus. A region that fits (a
          // dialog, a sheet of the whole screen) keeps the screen as it is.
          const height = await tab.evaluate(() => {
            (document.activeElement as HTMLElement | null)?.blur();
            window.scrollTo(0, 0);
            return Math.ceil(document.documentElement.scrollHeight);
          });
          await tab.setViewportSize({
            width: viewport.width,
            height: Math.max(viewport.height, height),
          });
          await expect(region).toHaveScreenshot(name, options);
        } else if (region) await expect(region).toHaveScreenshot(name, options);
        else await expect(tab).toHaveScreenshot(name, { ...options, fullPage: true });
        await context.close();
      });
    }
  }
}

import type { Page } from '@playwright/test';
import { expect, signIn, stub, test } from './support/fixtures';

/**
 * Interaction to Next Paint of the main gestures (ADR 0090): the processor slowed four times, as
 * in the mobile profile of Lighthouse; the longest interaction must stay under 200 ms.
 */
async function watchInteractions(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    const durations: number[] = [];
    (window as unknown as { interactions: number[] }).interactions = durations;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEventTiming[]) {
        if (entry.interactionId) durations.push(entry.duration);
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });
}

async function longestInteraction(page: Page): Promise<number> {
  const durations = await page.evaluate(
    () => (window as unknown as { interactions: number[] }).interactions,
  );
  expect(durations.length).toBeGreaterThan(0);
  const longest = Math.max(...durations);
  test.info().annotations.push({ type: 'longest interaction (ms)', description: String(longest) });
  return longest;
}

test('answers every interaction within 200 ms on a slowed processor', async ({ page }) => {
  await watchInteractions(page);
  await page.goto('/fr', { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: 'Vérifier les fondations' }).click();
  await expect(page.getByText('Les fondations répondent.')).toBeVisible();
  await page.getByRole('button', { name: 'Passer au thème sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Langue' }).click();
  await expect(page.getByRole('link', { name: 'English' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('radio', { name: 'Clair' }).click();
  await page.waitForTimeout(500);

  expect(await longestInteraction(page)).toBeLessThan(200);
});

test('reacts to a publication and opens the composer within 200 ms', async ({ page, request }) => {
  await stub(request).reset();
  await watchInteractions(page);
  await signIn(page, 'aissatou.ba@demo.pitchorium.test');
  await page.goto('/fr/feed', { waitUntil: 'networkidle' });

  const like = page
    .getByRole('article')
    .first()
    .getByRole('button', { name: "J'aime", exact: true });
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Commencer une publication' }).click();
  await expect(page.getByRole('dialog', { name: 'Créer une publication' })).toBeVisible();
  await page.waitForTimeout(500);

  expect(await longestInteraction(page)).toBeLessThan(200);
});

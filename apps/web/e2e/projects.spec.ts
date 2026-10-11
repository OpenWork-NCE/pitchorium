import { allowConsole, API_ORIGIN, expect, signIn, stub, test } from './support/fixtures';

const AISSATOU = 'aissatou.ba@demo.pitchorium.test';

test.beforeEach(async ({ request }) => {
  await stub(request).reset();
});

// A journey that withdraws the methodology or writes leaves nothing to the files after it.
test.afterEach(async ({ request }) => {
  await stub(request).reset();
});

/** The page of a project (§11.2, PROMPT FRONT 5A) on the stub api, in every state. */
test.describe('the page of a project', () => {
  test('gives a visitor its funding, tiers, rewards, structured data and share links', async ({
    page,
  }) => {
    await page.goto('/fr/projects/ferme-solaire-thies');
    const funding = page.getByRole('complementary', { name: 'Financement et actions' });
    await expect(
      funding.getByRole('progressbar', { name: /Financement de Ferme solaire/ }),
    ).toBeVisible();
    await expect(funding.getByText('12 jours restants').first()).toBeVisible();
    await expect(funding.getByText('Nous ouvrons le capital')).toBeVisible();
    await expect(funding.getByText(/aucun investissement ne se fait sur Pitchorium/)).toBeVisible();
    // A visitor has no indicative equivalent: no declared country.
    await expect(page.getByTestId('indicative-equivalent')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Paliers' })).toBeVisible();
    await expect(page.getByText('Épuisée').first()).toBeVisible();
    await expect(page.getByText('7 restantes sur 10').first()).toBeVisible();
    await expect(page.getByText(/Le love money n’a pas de contrepartie matérielle/)).toBeVisible();
    // The documents are listed to signed-in members only.
    await expect(page.getByRole('heading', { name: 'Documents' })).toHaveCount(0);
    const data = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
    ) as Record<string, unknown>;
    expect(data).toMatchObject({
      '@type': 'Article',
      headline: 'Ferme solaire coopérative de Thiès',
      author: { '@type': 'Person', name: 'Aïssatou Ba' },
    });
    await expect(page.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/\?text=Ferme%20solaire/,
    );
    await expect(page.getByRole('link', { name: /LinkedIn/ })).toHaveAttribute(
      'href',
      /^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=/,
    );
    const imageUrl = await page.locator('meta[property="og:image"]').getAttribute('content');
    const image = await page.request.get(imageUrl!);
    expect(image.headers()['content-type']).toBe('image/png');
  });

  test('loads the video of YouTube only at the click, in its privacy-respecting variant', async ({
    page,
  }) => {
    await page.route('https://www.youtube-nocookie.com/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>video</title>',
      }),
    );
    const requested: string[] = [];
    page.on('request', (request) => {
      if (/youtube|ytimg|vimeo/.test(request.url())) requested.push(request.url());
    });
    await page.goto('/fr/projects/ferme-solaire-thies');
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(requested).toEqual([]);
    await page
      .getByRole('button', { name: 'Lire la vidéo de Ferme solaire coopérative de Thiès' })
      .click();
    await expect(page.locator('iframe')).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1',
    );
  });

  test('gives a member of the CFA zone the exact indicative equivalent and the interest form', async ({
    page,
    request,
  }) => {
    await signIn(page, AISSATOU);
    await page.goto('/fr/projects/ferme-solaire-thies');
    // 12 500 EUR at 655.957 are 8 199 462.5 XOF, rounded to 8 199 463.
    await expect(page.getByTestId('indicative-equivalent')).toContainText(/8\s199\s463/);
    await expect(page.getByTestId('indicative-equivalent')).toContainText('équivalent indicatif');
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
    await page.getByRole('button', { name: 'Manifester un intérêt' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Manifester un intérêt' });
    await dialog
      .getByRole('radio', { name: /Contact général|Prise de participation/ })
      .first()
      .check();
    await dialog.getByLabel('Message').fill('Notre fonds suit les projets solaires du Sénégal.');
    await dialog.getByRole('button', { name: 'Envoyer' }).click();
    await expect(dialog).toBeHidden();
    expect((await stub(request).writes()).some((write) => write.route === 'interest')).toBe(true);
  });

  test('says when a campaign reached its goal and stays open, and when it closed', async ({
    page,
  }) => {
    await page.goto('/fr/projects/cooperative-karite-kaolack');
    await expect(page.getByText('Objectif atteint, la campagne reste ouverte')).toBeVisible();
    await expect(page.getByText('6 jours restants').first()).toBeVisible();
    await page.goto('/fr/projects/sechoirs-mbour');
    // Its closing date, never « 0 jour restant ».
    await expect(page.getByText('Clôturé le 10 octobre 2026').first()).toBeVisible();
    await expect(page.getByText('0 jour restant')).toHaveCount(0);
    // A closed campaign can still be followed (its updates go on).
    await expect(
      page.getByRole('link', { name: 'Se connecter pour suivre le projet' }).first(),
    ).toBeVisible();
  });

  test(
    'shows its contextual action bar on a phone, never a navigation bar',
    { tag: '@phone' },
    async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/fr/projects/ferme-solaire-thies');
      const bar = page.getByRole('region', { name: 'Actions du projet' });
      await expect(bar).toBeVisible();
      await expect(bar.getByText('62 % · 12 jours restants')).toBeVisible();
      // One main action, following as a bell named by its label.
      await expect(bar.getByRole('link', { name: 'Se connecter pour contribuer' })).toBeVisible();
      await expect(
        bar.getByRole('link', { name: 'Se connecter pour suivre le projet' }),
      ).toHaveText('');
      await expect(bar.getByRole('navigation')).toHaveCount(0);
      // In the middle of the page, at the bottom of the screen; at its end, the page ends with it,
      // above the footer: it covers nothing.
      const viewport = page.viewportSize()!;
      await page.locator('#tiers-title').scrollIntoViewIfNeeded();
      const middle = (await bar.boundingBox())!;
      expect(Math.round(middle.y + middle.height)).toBe(viewport.height);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const footer = (await page.getByRole('contentinfo').boundingBox())!;
      const end = (await bar.boundingBox())!;
      expect(Math.round(end.y + end.height)).toBeLessThanOrEqual(Math.round(footer.y));
    },
  );
});

/** The showcase (§10.6): filters and sort in the address, an empty state that resets them. */
test.describe('the showcase of the projects', () => {
  test('keeps its filters in the address and resets those that give nothing', async ({ page }) => {
    await page.goto('/fr/projects');
    await expect(page.getByRole('heading', { name: 'Sélection de l’équipe' })).toBeVisible();
    // The selects answer once hydrated, their code loaded on demand.
    await page.waitForLoadState('networkidle');
    await page.getByRole('combobox', { name: 'Statut' }).click();
    await page.getByRole('option', { name: 'Clôturé' }).click();
    await page.waitForURL(/status=closed/);
    await expect(
      page.getByRole('heading', { level: 3, name: 'Séchoirs à poisson de Mbour' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sélection de l’équipe' })).toHaveCount(0);
    await page.goto('/fr/projects?status=funded&country=GW');
    await expect(
      page.getByRole('heading', { name: 'Aucun projet ne correspond à ces filtres' }),
    ).toBeVisible();
    // The filters in force as removable chips, and the reset beside them.
    const chips = page.getByRole('list', { name: 'Filtres actifs' });
    await expect(chips.getByRole('listitem')).toHaveCount(2);
    await chips.getByRole('button', { name: 'Retirer le filtre Guinée-Bissau' }).click();
    await page.waitForURL((url) => !url.search.includes('country='));
    await expect(chips.getByRole('listitem')).toHaveCount(1);
    await page.getByRole('button', { name: 'Réinitialiser les filtres' }).first().click();
    await page.waitForURL((url) => !url.search.includes('status='));
    await expect(
      page.getByRole('heading', { level: 3, name: 'Ferme solaire coopérative de Thiès' }).first(),
    ).toBeVisible();
    await expect(page.getByRole('list', { name: 'Filtres actifs' })).toHaveCount(0);
  });

  test(
    'filters from a sheet on a phone, its count on the button, the chips above the results',
    { tag: '@phone' },
    async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/fr/projects');
      await page.waitForLoadState('networkidle');
      // The results show from the first screen, under the button of the filters.
      await expect(page.getByRole('heading', { level: 3 }).first()).toBeInViewport();
      await page.getByRole('button', { name: 'Filtres', exact: true }).click();
      const sheet = page.getByRole('dialog', { name: 'Filtrer les projets' });
      await sheet.getByRole('combobox', { name: 'Statut' }).click();
      await page.getByRole('option', { name: 'Clôturé' }).click();
      await page.waitForURL(/status=closed/);
      await sheet.getByRole('button', { name: 'Voir les résultats' }).click();
      await expect(sheet).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Filtres.*1 filtre actif/ })).toBeVisible();
      await expect(
        page.getByRole('list', { name: 'Filtres actifs' }).getByRole('listitem'),
      ).toHaveText(['Clôturé']);
      await expect(
        page.getByRole('heading', { level: 3, name: 'Séchoirs à poisson de Mbour' }),
      ).toBeVisible();
    },
  );
});

/** The self-declared impact (§12): the methodology, and its absence. */
test.describe('the methodology of the impact', () => {
  test('gives its criteria, weights and version, and says it is not a certification', async ({
    page,
  }) => {
    await page.goto('/fr/impact/methodology');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Méthodologie de l’impact' }),
    ).toBeVisible();
    await expect(page.getByText(/version 1/).first()).toBeVisible();
    await expect(page.getByText('Pondération : 40 %')).toBeVisible();
    await expect(page.getByText(/ni une certification, ni un label/)).toBeVisible();
  });

  test('says when no methodology is published, on its page and in the assistant', async ({
    page,
    request,
  }) => {
    allowConsole(/status of 409 .*\/v1\/impact\/methodology/);
    await request.post(`${API_ORIGIN}/__test/methodology`);
    await page.goto('/fr/impact/methodology');
    await expect(page.getByRole('heading', { name: 'Aucune méthodologie publiée' })).toBeVisible();
    await signIn(page, AISSATOU);
    await page.goto('/fr/projects/projet-en-preparation/edit/impact');
    await expect(page.getByRole('heading', { name: 'Aucune méthodologie publiée' })).toBeVisible();
  });
});

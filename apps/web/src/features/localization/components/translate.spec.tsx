// @vitest-environment jsdom
import type * as ApiClient from '@pitchorium/api-client';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/support/render';
import { ActiveLocalesProvider } from './active-locales';
import { Translatable } from './translate';

const translate = vi.hoisted(() => vi.fn());
vi.mock('@pitchorium/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof ApiClient>()),
  translationsControllerTranslate: translate,
}));

afterEach(() => vi.clearAllMocks());

function post(language: string | null, locales: ('fr' | 'en')[] = ['fr', 'en']) {
  renderWithProviders(
    <ActiveLocalesProvider locales={locales}>
      <Translatable source={{ type: 'post', id: 'post-1' }} language={language}>
        <p>We are hiring a finance mentor.</p>
      </Translatable>
    </ActiveLocalesProvider>,
  );
}

describe('the translation of a content', () => {
  it('is offered only in another language than the interface, when that language is active', () => {
    post('en');
    expect(screen.getByRole('button', { name: 'Traduire' })).toBeTruthy();
  });

  it('is not offered in the language of the interface, nor for an unknown language', () => {
    post('fr');
    expect(screen.queryByRole('button', { name: 'Traduire' })).toBeNull();
  });

  it('is not offered without a known language', () => {
    post(null);
    expect(screen.queryByRole('button', { name: 'Traduire' })).toBeNull();
  });

  it('shows the translation in place with its mention, then the original again', async () => {
    translate.mockResolvedValue({
      sourceType: 'post',
      sourceId: 'post-1',
      targetLocale: 'fr',
      sourceLanguage: 'en',
      fields: { text: 'Nous recrutons une mentore finance.' },
      machineTranslated: true,
      provider: 'deepl',
      notice: 'common.machineTranslation',
      cached: false,
    });
    post('en');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Traduire' }));
      await Promise.resolve();
    });
    const translated = await screen.findByText('Nous recrutons une mentore finance.');
    expect(translate).toHaveBeenCalledWith({
      sourceType: 'post',
      sourceId: 'post-1',
      targetLocale: 'fr',
    });
    expect(translated.closest('[data-active]')).toBeTruthy();
    expect(screen.getByText('Traduction automatique (DeepL).')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Voir l’original' }));
    const original = screen.getByText('We are hiring a finance mentor.');
    expect(original.closest('[data-active]')).toBeTruthy();
    expect(translated.closest('[data-active]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Voir la traduction' })).toBeTruthy();
  });

  it('says why the api refused, the limit of the day reached', async () => {
    const { ApiProblemError } = await vi.importActual<typeof ApiClient>('@pitchorium/api-client');
    translate.mockRejectedValue(
      new ApiProblemError({
        type: 'about:blank',
        title: 'LOCALIZATION_MEMBER_LIMIT_REACHED',
        status: 429,
        code: 'LOCALIZATION_MEMBER_LIMIT_REACHED',
      }),
    );
    post('en');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Traduire' }));
      await Promise.resolve();
    });
    expect(await screen.findByText(/Vous avez atteint votre limite de traductions/)).toBeTruthy();
  });
});

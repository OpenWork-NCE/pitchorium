import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import type { ReactElement } from 'react';
import { messagesFor } from '@/lib/i18n/messages';

/** Renders a component with the messages (French by default) and the theme provider of the app. */
export function renderWithProviders(
  ui: ReactElement,
  { locale = 'fr' }: { locale?: 'fr' | 'en' } = {},
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messagesFor(locale)} timeZone="UTC">
      <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
        {ui}
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

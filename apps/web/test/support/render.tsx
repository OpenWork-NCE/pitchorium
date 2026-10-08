import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import type { ReactElement } from 'react';
import { messagesFor } from '@/lib/i18n/messages';

/** Renders a component with the French messages and the theme provider of the app. */
export function renderWithProviders(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="fr" messages={messagesFor('fr')} timeZone="UTC">
      <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
        {ui}
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

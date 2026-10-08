'use client';

import type { Locale } from '@pitchorium/contracts';
import { type AbstractIntlMessages, NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { ActiveLocalesProvider } from '@/features/localization';
import { TimeZoneSync } from './time-zone-sync';

/**
 * The theme script runs from the server HTML, before the first paint. Rendered again in the
 * browser (a change of locale remounts the document), it would never run: typed as data there,
 * React does not warn about it.
 */
const THEME_SCRIPT_PROPS = {
  type: typeof window === 'undefined' ? 'text/javascript' : 'text/plain',
};

interface ProvidersProps {
  children: ReactNode;
  locale: Locale;
  messages: AbstractIntlMessages;
  timeZone: string;
  activeLocales: readonly Locale[];
  /** CSP nonce of the request, for the inline theme script. */
  nonce: string | undefined;
}

/**
 * Providers of every page, kept to what an editorial page needs (ADR 0094): messages of the
 * document, theme, active locales and the time zone. Data, realtime, motion features and toasts
 * are mounted by the shells that use them (docs/architecture/frontend.md).
 */
export function Providers({
  children,
  locale,
  messages,
  timeZone,
  activeLocales,
  nonce,
}: ProvidersProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        nonce={nonce}
        scriptProps={THEME_SCRIPT_PROPS}
      >
        <ActiveLocalesProvider locales={activeLocales}>
          {children}
          <TimeZoneSync />
        </ActiveLocalesProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}

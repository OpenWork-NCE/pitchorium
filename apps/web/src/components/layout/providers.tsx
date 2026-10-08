'use client';

import type { Locale } from '@pitchorium/contracts';
import { LazyMotion, MotionConfig } from 'motion/react';
import { type AbstractIntlMessages, NextIntlClientProvider } from 'next-intl';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui';
import { ActiveLocalesProvider } from '@/features/localization';
import { configureBrowserApi } from '@/lib/api/browser';
import { TimeZoneSync } from './time-zone-sync';

configureBrowserApi();

/** Features of Motion, loaded after the first paint: the components use `m`, not `motion`. */
const loadMotionFeatures = () =>
  import('@/components/motion/motion-features').then((module) => module.default);

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
  /** CSP nonce of the request, for the inline scripts and styles of the libraries. */
  nonce: string | undefined;
}

/** Providers of every page (docs/architecture/frontend.md). */
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
        <MotionConfig nonce={nonce} reducedMotion="user">
          <LazyMotion features={loadMotionFeatures} strict>
            <ActiveLocalesProvider locales={activeLocales}>
              {children}
              <Toaster />
              <TimeZoneSync />
            </ActiveLocalesProvider>
          </LazyMotion>
        </MotionConfig>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}

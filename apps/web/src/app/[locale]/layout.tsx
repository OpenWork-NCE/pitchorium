import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import { hasLocale } from 'next-intl';
import { getTimeZone, getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { preconnect } from 'react-dom';
import { Providers } from '@/components/layout/providers';
import { SkipLink } from '@/components/layout/skip-link';
import { SITE_NAME, siteConfig } from '@/config/site';
import { asLocale, routing } from '@/i18n/routing';
import { env } from '@/lib/env';
import { getActiveLocales } from '@/lib/i18n/active-locales';
import { clientMessages, messagesFor } from '@/lib/i18n/messages';
import { brandColors } from '@/styles/brand';
import { fontVariables } from '@/styles/fonts';
import '@/styles/globals.css';

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: asLocale(locale), namespace: 'web.metadata' });
  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: t('description'),
    applicationName: SITE_NAME,
    openGraph: { siteName: SITE_NAME, type: 'website', locale },
    twitter: { card: 'summary_large_image' },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: brandColors.white },
    { media: '(prefers-color-scheme: dark)', color: brandColors.black },
  ],
  colorScheme: 'light dark',
};

/** Document of every page: language, fonts, theme without flash, providers. */
export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const active = await getActiveLocales();
  // The proxy already redirects an inactive locale; this covers a request that bypassed it.
  if (!active.locales.includes(locale)) redirect(`/${active.defaultLocale}`);
  setRequestLocale(locale);

  // Connections opened early: the api (session cookie) and the public files.
  preconnect(siteConfig.apiUrl, { crossOrigin: 'use-credentials' });
  if (siteConfig.cdnUrl) preconnect(new URL(siteConfig.cdnUrl).origin);

  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const timeZone = await getTimeZone();

  return (
    <html lang={locale} dir="ltr" className={fontVariables} suppressHydrationWarning>
      <body>
        <Providers
          locale={locale}
          messages={clientMessages(messagesFor(locale))}
          timeZone={timeZone}
          activeLocales={active.locales}
          nonce={nonce}
        >
          <SkipLink />
          {children}
        </Providers>
        {env.NEXT_PUBLIC_VERCEL_ANALYTICS ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}

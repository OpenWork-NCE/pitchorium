import { getTranslations } from 'next-intl/server';
import { StatusView } from '@/components/layout/status-view';
import { buttonVariants } from '@/components/ui';
import { routing } from '@/i18n/routing';
import { fontVariables } from '@/styles/fonts';
import '@/styles/globals.css';

/**
 * 404 of a request outside any locale (a missing file, for instance): the proxy sends every
 * page path to a locale, so this page only renders in the default locale.
 */
export default async function GlobalNotFound() {
  const locale = routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'web.notFound' });
  return (
    <html lang={locale} className={fontVariables}>
      <body>
        <main id="main">
          <StatusView
            code={t('code')}
            title={t('title')}
            body={t('body')}
            actions={
              <a href={`/${locale}`} className={buttonVariants()}>
                {t('home')}
              </a>
            }
          />
        </main>
      </body>
    </html>
  );
}

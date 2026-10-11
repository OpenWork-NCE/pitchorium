import { coverageControllerRead } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import * as routes from '@/config/paths';
import { alternatesFor } from '@/config/seo';
import { TransparencyPage } from '@/features/marketing';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { getActiveLocales } from '@/lib/i18n/active-locales';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/transparency'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('web.marketing.transparency');
  const { locales } = await getActiveLocales();
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor(asLocale(locale), routes.transparency, locales),
  };
}

/**
 * Transparency and fees (ADR 0156): the commission and the coverage come from the public route
 * of the api (an hour of shared cache there); without an answer, the page says so.
 */
export default async function Page({ params }: PageProps<'/[locale]/transparency'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  const coverage = await coverageControllerRead({ next: { revalidate: 3600 } }).catch(() => null);
  return <TransparencyPage coverage={coverage} />;
}

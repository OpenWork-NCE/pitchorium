import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import * as routes from '@/config/paths';
import { alternatesFor } from '@/config/seo';
import { HowItWorksPage } from '@/features/marketing';
import { asLocale } from '@/i18n/routing';
import { getActiveLocales } from '@/lib/i18n/active-locales';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/how-it-works'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('web.marketing.howItWorks');
  const { locales } = await getActiveLocales();
  return {
    title: t('title'),
    description: t('description'),
    alternates: alternatesFor(asLocale(locale), routes.howItWorks, locales),
  };
}

/** How Pitchorium works, for the entrepreneurs and the contributors (ADR 0156). */
export default async function Page({ params }: PageProps<'/[locale]/how-it-works'>) {
  setRequestLocale(asLocale((await params).locale));
  return <HowItWorksPage />;
}

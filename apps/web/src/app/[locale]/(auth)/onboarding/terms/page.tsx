import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TermsStep } from '@/features/identity';
import { asLocale } from '@/i18n/routing';
import { getAuthConfiguration } from '@/lib/auth/configuration';
import { REDIRECT_PARAM, safeRedirect } from '@/lib/auth/redirect';
import { firstParam } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.onboarding.terms');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/onboarding/terms'>) {
  setRequestLocale(asLocale((await params).locale));
  const redirectTo = safeRedirect(firstParam(await searchParams, REDIRECT_PARAM), '') || null;
  const { legal } = await getAuthConfiguration();
  return <TermsStep versions={legal} redirectTo={redirectTo} />;
}

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TwoFactorScreen } from '@/features/identity';
import { asLocale } from '@/i18n/routing';
import { REDIRECT_PARAM, safeRedirect } from '@/lib/auth/redirect';
import { firstParam } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.auth.twoFactor');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/sign-in/two-factor'>) {
  setRequestLocale(asLocale((await params).locale));
  const redirectTo = safeRedirect(firstParam(await searchParams, REDIRECT_PARAM), '') || null;
  return <TwoFactorScreen redirectTo={redirectTo} />;
}

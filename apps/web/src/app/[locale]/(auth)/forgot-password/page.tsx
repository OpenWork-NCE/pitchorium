import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ForgotPasswordScreen } from '@/features/identity';
import { asLocale } from '@/i18n/routing';
import { getAuthConfiguration } from '@/lib/auth/configuration';
import { REDIRECT_PARAM, safeRedirect } from '@/lib/auth/redirect';
import { firstParam } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.auth.forgotPassword');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/forgot-password'>) {
  setRequestLocale(asLocale((await params).locale));
  const redirectTo = safeRedirect(firstParam(await searchParams, REDIRECT_PARAM), '') || null;
  return <ForgotPasswordScreen config={await getAuthConfiguration()} redirectTo={redirectTo} />;
}

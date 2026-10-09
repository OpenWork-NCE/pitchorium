import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ResetPasswordScreen } from '@/features/identity';
import { asLocale } from '@/i18n/routing';
import { getAuthConfiguration } from '@/lib/auth/configuration';
import { firstParam } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.auth.resetPassword');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** Arrival of the reset link: the api adds `token`, or `error` for a used or expired link. */
export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/reset-password'>) {
  setRequestLocale(asLocale((await params).locale));
  const query = await searchParams;
  const config = await getAuthConfiguration();
  return (
    <ResetPasswordScreen
      token={firstParam(query, 'token')}
      error={firstParam(query, 'error')}
      minPasswordLength={config.minPasswordLength}
    />
  );
}

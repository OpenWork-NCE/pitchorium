import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountSettings } from '@/features/identity';
import { asLocale } from '@/i18n/routing';
import { getAuthConfiguration } from '@/lib/auth/configuration';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.settings.sections');
  return { title: t('account'), robots: { index: false, follow: false } };
}

export default async function Page({ params }: PageProps<'/[locale]/settings/account'>) {
  setRequestLocale(asLocale((await params).locale));
  const { oauthProviders } = await getAuthConfiguration();
  return <AccountSettings providers={oauthProviders} />;
}

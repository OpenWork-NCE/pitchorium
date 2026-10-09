import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PreferencesSettings } from '@/features/identity';
import { asLocale } from '@/i18n/routing';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.settings.sections');
  return { title: t('preferences'), robots: { index: false, follow: false } };
}

export default async function Page({ params }: PageProps<'/[locale]/settings/preferences'>) {
  setRequestLocale(asLocale((await params).locale));
  return <PreferencesSettings />;
}

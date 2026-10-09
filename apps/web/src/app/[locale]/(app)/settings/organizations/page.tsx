import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MyOrganizations } from '@/features/organizations';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.settings.sections');
  return { title: t('organizations'), robots: { index: false, follow: false } };
}

/** « Mes organisations »: their role in each, the way to manage it, the creation of another. */
export default async function Page({ params }: PageProps<'/[locale]/settings/organizations'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  return <MyOrganizations />;
}

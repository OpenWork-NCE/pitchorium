import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SecuritySettings } from '@/features/identity';
import { asLocale } from '@/i18n/routing';
import { firstParam } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.settings.sections');
  return { title: t('security'), robots: { index: false, follow: false } };
}

/** `?required=two-factor`: arrival of a moderator or an administrator without a second factor. */
export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/settings/security'>) {
  setRequestLocale(asLocale((await params).locale));
  const required = firstParam(await searchParams, 'required') === 'two-factor';
  return <SecuritySettings twoFactorRequired={required} />;
}

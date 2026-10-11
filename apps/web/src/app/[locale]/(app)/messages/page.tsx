import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NoConversation } from '@/features/messaging';
import { asLocale } from '@/i18n/routing';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.messaging');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The list alone (a phone), or beside the panel that invites to choose (a computer). */
export default async function Page({ params }: PageProps<'/[locale]/messages'>) {
  setRequestLocale(asLocale((await params).locale));
  return <NoConversation />;
}

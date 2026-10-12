import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountDeleted } from '@/features/privacy';
import { asLocale } from '@/i18n/routing';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.privacy.deleted');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The neutral page the member lands on once the account is deleted (ADR 0164). */
export default async function Page({ params }: PageProps<'/[locale]/account-deleted'>) {
  setRequestLocale(asLocale((await params).locale));
  return <AccountDeleted />;
}

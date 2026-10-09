import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EmailVerifiedScreen } from '@/features/identity';
import { asLocale } from '@/i18n/routing';
import { firstParam } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.auth.emailVerified');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** Arrival of a verification link, or of a sign-in link that failed (`kind=magic`). */
export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/email-verified'>) {
  setRequestLocale(asLocale((await params).locale));
  const query = await searchParams;
  return (
    <EmailVerifiedScreen
      error={firstParam(query, 'error')}
      kind={firstParam(query, 'kind') === 'magic' ? 'magic' : 'verify'}
    />
  );
}

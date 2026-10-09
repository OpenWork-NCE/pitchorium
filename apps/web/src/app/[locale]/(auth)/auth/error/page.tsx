import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthErrorScreen } from '@/features/identity';
import { asLocale } from '@/i18n/routing';
import { firstParam } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.auth.oauthError');
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/** Failure of a sign-in with a provider, as Better Auth redirects it (`error`). */
export default async function Page({ params, searchParams }: PageProps<'/[locale]/auth/error'>) {
  setRequestLocale(asLocale((await params).locale));
  return <AuthErrorScreen error={firstParam(await searchParams, 'error')} />;
}

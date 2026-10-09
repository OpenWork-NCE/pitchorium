import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckEmailScreen, type EmailKind } from '@/features/identity';
import { asLocale } from '@/i18n/routing';
import { getAuthConfiguration } from '@/lib/auth/configuration';
import { REDIRECT_PARAM, safeRedirect } from '@/lib/auth/redirect';
import { firstParam } from '@/lib/search-params';

const KINDS: readonly EmailKind[] = ['verify', 'magic', 'reset'];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.auth.checkEmail');
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

export default async function Page({ params, searchParams }: PageProps<'/[locale]/check-email'>) {
  setRequestLocale(asLocale((await params).locale));
  const query = await searchParams;
  const kind = firstParam(query, 'kind');
  const email = firstParam(query, 'email');
  return (
    <CheckEmailScreen
      config={await getAuthConfiguration()}
      kind={KINDS.find((known) => known === kind) ?? 'verify'}
      email={email && email.length <= 254 && email.includes('@') ? email : null}
      redirectTo={safeRedirect(firstParam(query, REDIRECT_PARAM), '') || null}
    />
  );
}

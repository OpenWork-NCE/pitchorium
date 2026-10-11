import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { Heading } from '@/components/ui';
import { Unsubscribe } from '@/features/notifications';
import { asLocale } from '@/i18n/routing';
import { getCurrentMember } from '@/lib/auth/session';

/** The token is in the address: never sent as a referrer, never indexed. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.unsubscribe');
  return { title: t('title'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

/**
 * The page of the link of an email that turns its notifications off (§10.5, ADR 0062), in the
 * frame of the authentication (one screen, the brand beside): for a visitor or a member, the
 * token authorizes; done by the browser, with an undo.
 */
export default async function Page({ params, searchParams }: PageProps<'/[locale]/unsubscribe'>) {
  setRequestLocale(asLocale((await params).locale));
  const token = (await searchParams)['token'];
  if (typeof token !== 'string' || token.length < 16 || token.length > 512) notFound();
  const t = await getTranslations('web.unsubscribe');
  const member = await getCurrentMember();
  return (
    <div className="grid gap-6">
      <Heading level={1} size="page">
        {t('title')}
      </Heading>
      <ScopedMessages scope="unsubscribe">
        <Unsubscribe token={token} signedIn={member !== null} />
      </ScopedMessages>
    </div>
  );
}

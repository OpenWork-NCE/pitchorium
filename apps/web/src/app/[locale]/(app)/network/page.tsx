import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { initialCounters } from '@/components/layout/member/initial-counters';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading } from '@/components/ui';
import { routes } from '@/config/routes';
import { NetworkPage } from '@/features/network';
import { asLocale } from '@/i18n/routing';
import { getCurrentMember } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.nav');
  return { title: t('network'), robots: { index: false, follow: false } };
}

/** « Réseau » (§10.2): invitations, suggestions and lists of the member, one tab each. */
export default async function Page({ params }: PageProps<'/[locale]/network'>) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const [member, counters] = await Promise.all([getCurrentMember(), initialCounters()]);
  if (!member) redirect(`/${locale}${routes.signIn}`);
  const t = await getTranslations('web.network.page');
  return (
    <SingleColumnLayout>
      <div className="grid gap-6">
        <Heading level={1} size="page">
          {t('title')}
        </Heading>
        <NetworkPage
          handle={member.profile.handle}
          name={member.profile.displayName}
          counters={counters}
        />
      </div>
    </SingleColumnLayout>
  );
}

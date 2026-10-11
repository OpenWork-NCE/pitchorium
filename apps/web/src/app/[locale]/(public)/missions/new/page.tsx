import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { LazyMissionForm } from '@/features/missions';
import { asLocale } from '@/i18n/routing';
import { withRedirect } from '@/lib/auth/redirect';
import { getCurrentMember } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.missions.form');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** Creation of a mission (§6.3): an offer (`?direction=offer`) or a request (`?direction=request`). */
export default async function Page({ params, searchParams }: PageProps<'/[locale]/missions/new'>) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const { direction } = await searchParams;
  const sense = direction === 'request' ? 'request' : 'offer';
  if (!(await getCurrentMember())) {
    redirect(
      withRedirect(
        `/${locale}${routes.signIn}`,
        `/${locale}${routes.createMission}?direction=${sense}`,
      ),
    );
  }
  const t = await getTranslations('web.missions.form');
  return (
    <SingleColumnLayout width="prose">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Heading level={1} size="page">
            {t('title')}
          </Heading>
          <Text tone="muted">{t('lede')}</Text>
        </div>
        <LazyMissionForm direction={sense} />
      </div>
    </SingleColumnLayout>
  );
}

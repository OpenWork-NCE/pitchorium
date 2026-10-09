import { profileViewsControllerSettings } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading } from '@/components/ui';
import { ProfileVisits, ProfileVisitsIntro } from '@/features/network';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.network.visits');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** « Qui a consulté votre profil » (§10.2): the counts by period, the visits, the setting. */
export default async function Page({ params }: PageProps<'/[locale]/network/profile-views'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  const t = await getTranslations('web.network.visits');
  const settings = await profileViewsControllerSettings({ cache: 'no-store' });
  return (
    <SingleColumnLayout width="prose">
      <div className="grid gap-6">
        <Heading level={1} size="page">
          {t('title')}
        </Heading>
        <ProfileVisitsIntro privateVisits={settings.privateProfileViews} />
        <ProfileVisits />
      </div>
    </SingleColumnLayout>
  );
}

import { missionsControllerEngagement } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Breadcrumbs, Heading } from '@/components/ui';
import * as routes from '@/config/paths';
import { EngagementView } from '@/features/missions';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { withRedirect } from '@/lib/auth/redirect';
import { getCurrentMember } from '@/lib/auth/session';
import { isNotFound } from '@/lib/resources/view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.missions.engagement');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * An engagement on a mission, for its two parties and the author of the mission (the api answers
 * 404 to anyone else); where the notifications of the missions lead (question 132).
 */
export default async function Page({
  params,
}: PageProps<'/[locale]/missions/engagements/[engagementId]'>) {
  const { locale: raw, engagementId } = await params;
  const locale = asLocale(raw);
  setRequestLocale(locale);
  const member = await getCurrentMember();
  if (!member) {
    redirect(
      withRedirect(
        `/${locale}${routes.signIn}`,
        `/${locale}${routes.missionEngagement(engagementId)}`,
      ),
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(engagementId)) notFound();
  configureServerApi();
  const engagement = await missionsControllerEngagement(engagementId, { cache: 'no-store' }).catch(
    (error: unknown) => {
      if (isNotFound(error)) return null;
      throw error;
    },
  );
  if (!engagement) notFound();
  const t = await getTranslations('web.missions.engagement');
  return (
    <SingleColumnLayout width="page">
      <div className="grid gap-6">
        <Breadcrumbs
          items={[
            { label: t('breadcrumb'), href: `${routes.missions}?tab=engagements` },
            { label: engagement.mission.title },
          ]}
        />
        <Heading level={1} size="page">
          {engagement.mission.title}
        </Heading>
        <EngagementView engagement={engagement} viewerHandle={member.profile.handle} />
      </div>
    </SingleColumnLayout>
  );
}

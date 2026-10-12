import { moderationControllerDetail, moderationControllerModerators } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { CaseDetail } from '@/features/trust';
import { asLocale } from '@/i18n/routing';
import { consoleRead } from '@/lib/api/console-read';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.moderation.case');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** A case of the moderation: what was reported, the reports, the decision; its reading is audited. */
export default async function Page({
  params,
}: PageProps<'/[locale]/admin/moderation/cases/[caseId]'>) {
  const { locale, caseId } = await params;
  setRequestLocale(asLocale(locale));
  configureServerApi();
  const t = await getTranslations('web.admin');
  const reference = await getTranslations('reference');
  const [detail, moderators, member] = await Promise.all([
    consoleRead(moderationControllerDetail(caseId, { cache: 'no-store' })),
    moderationControllerModerators({ cache: 'no-store' }).then(
      (list) => list.items,
      () => [],
    ),
    getCurrentMember(),
  ]);
  const title = t('moderation.case.target', {
    type: reference(`reportTargetTypes.${detail.targetType}`),
  });
  return (
    <AdminPage
      breadcrumbs={[
        { label: t('label'), href: routes.admin },
        { label: t('nav.moderation'), href: routes.adminModeration },
        { label: t('moderation.case.title') },
      ]}
      title={title}
      audited
    >
      <CaseDetail detail={detail} readerId={member?.user.id ?? ''} moderators={moderators} />
    </AdminPage>
  );
}

import { adminControllerMember } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { MemberFile } from '@/features/admin';
import { MemberModeration } from '@/features/trust';
import { asLocale } from '@/i18n/routing';
import { consoleRead } from '@/lib/api/console-read';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.nav');
  return { title: t('members'), robots: { index: false, follow: false } };
}

/** The file of a member (account, roles, sessions, standing, decisions, contributions), audited. */
export default async function Page({ params }: PageProps<'/[locale]/admin/members/[userId]'>) {
  const { locale, userId } = await params;
  setRequestLocale(asLocale(locale));
  configureServerApi();
  const t = await getTranslations('web.admin');
  const file = await consoleRead(adminControllerMember(userId, { cache: 'no-store' }));
  return (
    <AdminPage
      breadcrumbs={[
        { label: t('label'), href: routes.admin },
        { label: t('members.title'), href: routes.adminMembers },
        { label: file.name },
      ]}
      title={file.name}
      audited
    >
      <MemberFile
        file={file}
        moderation={
          <MemberModeration
            userId={file.userId}
            name={file.name}
            suspensionId={file.suspension?.id ?? null}
          />
        }
      />
    </AdminPage>
  );
}

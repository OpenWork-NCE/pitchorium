import { moderationControllerAppeals } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { AppealsQueue } from '@/features/trust';
import { asLocale } from '@/i18n/routing';
import { consoleRead } from '@/lib/api/console-read';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.moderation.appeals');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The pending appeals, each resolvable by another person than the author of its decision. */
export default async function Page({ params }: PageProps<'/[locale]/admin/moderation/appeals'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  const t = await getTranslations('web.admin');
  const page = await consoleRead(moderationControllerAppeals({ limit: 20 }, { cache: 'no-store' }));
  return (
    <AdminPage
      breadcrumbs={[
        { label: t('label'), href: routes.admin },
        { label: t('nav.moderation'), href: routes.adminModeration },
        { label: t('nav.appeals') },
      ]}
      title={t('moderation.appeals.title')}
      description={t('moderation.appeals.description')}
      audited
    >
      <AppealsQueue page={page} />
    </AdminPage>
  );
}

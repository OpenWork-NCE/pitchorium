import { adminControllerFailedJobs } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { FailedJobs } from '@/features/admin';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.jobs');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The jobs failed for good, grouped by queue, with their masked payload. */
export default async function Page({ params }: PageProps<'/[locale]/admin/jobs'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  const t = await getTranslations('web.admin');
  const { items } = await adminControllerFailedJobs({ limit: 100 }, { cache: 'no-store' });
  return (
    <AdminPage
      breadcrumbs={[{ label: t('label'), href: routes.admin }, { label: t('nav.jobs') }]}
      title={t('jobs.title')}
      description={t('jobs.description')}
    >
      <FailedJobs items={items} />
    </AdminPage>
  );
}

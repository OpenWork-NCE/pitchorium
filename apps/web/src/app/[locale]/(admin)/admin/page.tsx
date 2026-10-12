import {
  adminControllerQueues,
  adminControllerStats,
  ApiProblemError,
} from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import { Dashboard } from '@/features/admin';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.dashboard');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The dashboard of the console: the queues of the reader, then the figures of the platform. */
export default async function Page({ params }: PageProps<'/[locale]/admin'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  const t = await getTranslations('web.admin');
  const [queues, stats] = await Promise.all([
    adminControllerQueues({ cache: 'no-store' }),
    // The figures of the platform are an administrator's (admin.stats.read).
    adminControllerStats({ cache: 'no-store' }).catch((error: unknown) => {
      if (error instanceof ApiProblemError && error.problem.code === 'FORBIDDEN') return null;
      throw error;
    }),
  ]);
  return (
    <AdminPage
      breadcrumbs={[{ label: t('label') }]}
      title={t('dashboard.title')}
      description={t('dashboard.description')}
    >
      <Dashboard queues={queues} stats={stats} />
    </AdminPage>
  );
}

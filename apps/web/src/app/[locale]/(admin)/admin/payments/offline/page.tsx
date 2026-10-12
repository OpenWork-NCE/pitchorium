import { adminPaymentsControllerOfflineQueue } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { OfflineReview } from '@/features/payments';
import { asLocale } from '@/i18n/routing';
import { consoleRead } from '@/lib/api/console-read';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.payments.offline');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The off-platform contributions confirmed by both parties, waiting for a validation on proof. */
export default async function Page({ params }: PageProps<'/[locale]/admin/payments/offline'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  const t = await getTranslations('web.admin');
  const page = await consoleRead(
    adminPaymentsControllerOfflineQueue({ status: 'confirmed', limit: 20 }, { cache: 'no-store' }),
  );
  return (
    <AdminPage
      breadcrumbs={[{ label: t('label'), href: routes.admin }, { label: t('nav.offline') }]}
      title={t('payments.offline.title')}
      description={t('payments.offline.description')}
      audited
    >
      <OfflineReview page={page} />
    </AdminPage>
  );
}

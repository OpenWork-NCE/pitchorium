import { adminPaymentsControllerDiscrepancies } from '@pitchorium/api-client';
import { DISCREPANCY_STATUSES } from '@pitchorium/contracts';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { UrlFilters } from '@/features/admin';
import { Discrepancies } from '@/features/payments';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.payments.discrepancies');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The discrepancies of the reconciliation, by status (`?status=`, open by default). */
export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/admin/payments/discrepancies'>) {
  setRequestLocale(asLocale((await params).locale));
  const requested = (await searchParams)['status'];
  const status = DISCREPANCY_STATUSES.find((value) => value === requested) ?? 'open';
  configureServerApi();
  const t = await getTranslations('web.admin');
  const reference = await getTranslations('reference');
  const page = await adminPaymentsControllerDiscrepancies(
    { status, limit: 20 },
    { cache: 'no-store' },
  );
  return (
    <AdminPage
      breadcrumbs={[{ label: t('label'), href: routes.admin }, { label: t('nav.discrepancies') }]}
      title={t('payments.discrepancies.title')}
      description={t('payments.discrepancies.description')}
    >
      <UrlFilters
        filters={[
          {
            name: 'status',
            label: t('payments.discrepancies.filter'),
            control: 'buttons',
            defaultValue: 'open',
            options: DISCREPANCY_STATUSES.map((value) => ({
              value,
              label: reference(`discrepancyStatuses.${value}`),
            })),
          },
        ]}
      >
        <Discrepancies key={status} page={page} status={status} />
      </UrlFilters>
    </AdminPage>
  );
}

import { adminPaymentsControllerKycQueue } from '@pitchorium/api-client';
import { KYC_REVIEW_STATUSES } from '@pitchorium/contracts';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { UrlFilters } from '@/features/admin';
import { KycQueue } from '@/features/payments';
import { asLocale } from '@/i18n/routing';
import { consoleRead } from '@/lib/api/console-read';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.payments.kyc');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The identity verifications of the holders, by status (`?status=`, pending by default). */
export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/admin/payments/kyc'>) {
  setRequestLocale(asLocale((await params).locale));
  const requested = (await searchParams)['status'];
  const status = KYC_REVIEW_STATUSES.find((value) => value === requested) ?? 'pending';
  configureServerApi();
  const t = await getTranslations('web.admin');
  const reference = await getTranslations('reference');
  const page = await consoleRead(
    adminPaymentsControllerKycQueue({ status, limit: 25 }, { cache: 'no-store' }),
  );
  return (
    <AdminPage
      breadcrumbs={[{ label: t('label'), href: routes.admin }, { label: t('nav.kyc') }]}
      title={t('payments.kyc.title')}
      description={t('payments.kyc.description')}
      audited
    >
      <UrlFilters
        filters={[
          {
            name: 'status',
            label: t('payments.kyc.filter'),
            control: 'buttons',
            defaultValue: 'pending',
            options: KYC_REVIEW_STATUSES.map((value) => ({
              value,
              label: reference(`kycReviewStatuses.${value}`),
            })),
          },
        ]}
      >
        <KycQueue key={status} page={page} status={status} />
      </UrlFilters>
    </AdminPage>
  );
}

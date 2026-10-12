import { verificationControllerQueue } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { UrlFilters } from '@/features/admin';
import { VerificationQueue } from '@/features/organizations';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.verification');
  return { title: t('title'), robots: { index: false, follow: false } };
}

const STATUSES = ['pending', 'approved', 'rejected'] as const;

/** The verification requests of the organisations, by status (`?status=`, pending by default). */
export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/admin/organizations'>) {
  setRequestLocale(asLocale((await params).locale));
  const requested = (await searchParams)['status'];
  const status = STATUSES.find((value) => value === requested) ?? 'pending';
  configureServerApi();
  const t = await getTranslations('web.admin');
  const queue = await verificationControllerQueue({ status }, { cache: 'no-store' });
  return (
    <AdminPage
      breadcrumbs={[{ label: t('label'), href: routes.admin }, { label: t('nav.organizations') }]}
      title={t('verification.title')}
      description={t('verification.description')}
    >
      <UrlFilters
        filters={[
          {
            name: 'status',
            label: t('verification.filter'),
            control: 'buttons',
            defaultValue: 'pending',
            options: STATUSES.map((value) => ({ value, label: t(`verification.status.${value}`) })),
          },
        ]}
      >
        <VerificationQueue key={status} queue={queue} />
      </UrlFilters>
    </AdminPage>
  );
}

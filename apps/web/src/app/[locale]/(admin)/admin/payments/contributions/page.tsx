import { adminPaymentsControllerSearch } from '@pitchorium/api-client';
import { CONTRIBUTION_STATUSES } from '@pitchorium/contracts';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { SearchField, UrlFilters } from '@/features/admin';
import { ContributionResults } from '@/features/payments';
import { asLocale } from '@/i18n/routing';
import { consoleRead } from '@/lib/api/console-read';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.payments.contributions');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/**
 * The search of the contributions (`?q=`: identifier, contributor handle or payment reference;
 * `?status=`), audited by the api, newest first.
 */
export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/admin/payments/contributions'>) {
  setRequestLocale(asLocale((await params).locale));
  const search = await searchParams;
  const q = typeof search['q'] === 'string' ? search['q'].trim() : '';
  const status = CONTRIBUTION_STATUSES.find((value) => value === search['status']);
  const query = { ...(q.length >= 2 ? { q } : {}), ...(status ? { status } : {}) };
  configureServerApi();
  const t = await getTranslations('web.admin');
  const reference = await getTranslations('reference');
  const page = await consoleRead(
    adminPaymentsControllerSearch({ ...query, limit: 25 }, { cache: 'no-store' }),
  );
  return (
    <AdminPage
      breadcrumbs={[{ label: t('label'), href: routes.admin }, { label: t('nav.contributions') }]}
      title={t('payments.contributions.title')}
      description={t('payments.contributions.description')}
      audited
    >
      <SearchField
        label={t('payments.contributions.searchLabel')}
        placeholder={t('payments.contributions.searchPlaceholder')}
      />
      <UrlFilters
        filters={[
          {
            name: 'status',
            label: t('payments.contributions.filter'),
            control: 'select',
            defaultValue: '',
            options: [
              { value: '', label: t('common.all') },
              ...CONTRIBUTION_STATUSES.map((value) => ({
                value,
                label: reference(`contributionStatuses.${value}`),
              })),
            ],
          },
        ]}
      >
        <ContributionResults key={`${q}:${status ?? ''}`} page={page} query={query} />
      </UrlFilters>
    </AdminPage>
  );
}

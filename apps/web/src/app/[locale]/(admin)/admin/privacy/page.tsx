import { privacyControllerRightsRequests } from '@pitchorium/api-client';
import { RIGHTS_REQUEST_KINDS } from '@pitchorium/contracts';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { UrlFilters } from '@/features/admin';
import { RightsRequests } from '@/features/privacy';
import { asLocale } from '@/i18n/routing';
import { consoleRead } from '@/lib/api/console-read';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.rights');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The exports and erasures of the members (`?kind=`), with their legal deadline. */
export default async function Page({ params, searchParams }: PageProps<'/[locale]/admin/privacy'>) {
  setRequestLocale(asLocale((await params).locale));
  const requested = (await searchParams)['kind'];
  const kind = RIGHTS_REQUEST_KINDS.find((value) => value === requested);
  configureServerApi();
  const t = await getTranslations('web.admin');
  const reference = await getTranslations('reference');
  const page = await consoleRead(
    privacyControllerRightsRequests(
      { ...(kind ? { kind } : {}), limit: 25 },
      { cache: 'no-store' },
    ),
  );
  return (
    <AdminPage
      breadcrumbs={[{ label: t('label'), href: routes.admin }, { label: t('nav.rights') }]}
      title={t('rights.title')}
      description={t('rights.description')}
      audited
    >
      <UrlFilters
        filters={[
          {
            name: 'kind',
            label: t('rights.filter'),
            control: 'buttons',
            defaultValue: '',
            options: [
              { value: '', label: t('common.all') },
              ...RIGHTS_REQUEST_KINDS.map((value) => ({
                value,
                label: reference(`rightsRequestKinds.${value}`),
              })),
            ],
          },
        ]}
      >
        <RightsRequests key={kind ?? 'all'} page={page} kind={kind} />
      </UrlFilters>
    </AdminPage>
  );
}

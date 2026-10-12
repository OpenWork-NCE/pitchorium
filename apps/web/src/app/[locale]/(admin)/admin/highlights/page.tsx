import { adminControllerHighlights } from '@pitchorium/api-client';
import { HIGHLIGHT_TARGET_TYPES } from '@pitchorium/contracts';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { Highlights, UrlFilters } from '@/features/admin';
import { asLocale } from '@/i18n/routing';
import { consoleRead } from '@/lib/api/console-read';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.highlights');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The editorial highlights, every type or one (`?type=`), in their order of display. */
export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/admin/highlights'>) {
  setRequestLocale(asLocale((await params).locale));
  const requested = (await searchParams)['type'];
  const targetType = HIGHLIGHT_TARGET_TYPES.find((value) => value === requested);
  configureServerApi();
  const t = await getTranslations('web.admin');
  const { items } = await consoleRead(
    adminControllerHighlights(targetType ? { targetType } : {}, {
      cache: 'no-store',
    }),
  );
  return (
    <AdminPage
      breadcrumbs={[{ label: t('label'), href: routes.admin }, { label: t('nav.highlights') }]}
      title={t('highlights.title')}
      description={t('highlights.description')}
    >
      <UrlFilters
        filters={[
          {
            name: 'type',
            label: t('highlights.filter'),
            control: 'buttons',
            defaultValue: '',
            options: [
              { value: '', label: t('common.all') },
              ...HIGHLIGHT_TARGET_TYPES.map((value) => ({
                value,
                label: t(`highlights.types.${value}`),
              })),
            ],
          },
        ]}
      >
        <Highlights key={targetType ?? 'all'} items={items} targetType={targetType} />
      </UrlFilters>
    </AdminPage>
  );
}

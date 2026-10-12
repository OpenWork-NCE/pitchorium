import { moderationControllerReport } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { TransparencyPeriod, TransparencyReport } from '@/features/trust';
import { asLocale } from '@/i18n/routing';
import { consoleRead } from '@/lib/api/console-read';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.moderation.transparency');
  return { title: t('title'), robots: { index: false, follow: false } };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayOf = (instant: number) => new Date(instant).toISOString().slice(0, 10);

/** The transparency counters of a period (`?from=&to=`, the last 30 days by default). */
export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/admin/moderation/transparency'>) {
  setRequestLocale(asLocale((await params).locale));
  const search = await searchParams;
  const to =
    typeof search['to'] === 'string' && DAY.test(search['to'])
      ? search['to']
      : dayOf(new Date().getTime());
  const from =
    typeof search['from'] === 'string' && DAY.test(search['from'])
      ? search['from']
      : dayOf(Date.parse(to) - 29 * 86_400_000);
  configureServerApi();
  const t = await getTranslations('web.admin');
  const report = await consoleRead(moderationControllerReport({ from, to }, { cache: 'no-store' }));
  return (
    <AdminPage
      breadcrumbs={[
        { label: t('label'), href: routes.admin },
        { label: t('nav.moderation'), href: routes.adminModeration },
        { label: t('nav.transparency') },
      ]}
      title={t('moderation.transparency.title')}
      description={t('moderation.transparency.description')}
    >
      <TransparencyPeriod from={from} to={to} />
      <TransparencyReport report={report} />
    </AdminPage>
  );
}

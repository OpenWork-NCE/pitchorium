import { methodologiesControllerList } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { MethodologyList } from '@/features/impact';
import { asLocale } from '@/i18n/routing';
import { consoleRead } from '@/lib/api/console-read';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.impact');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The versions of the impact methodology: drafts, the published one, archives. */
export default async function Page({ params }: PageProps<'/[locale]/admin/impact'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  const t = await getTranslations('web.admin');
  const { items } = await consoleRead(methodologiesControllerList({ cache: 'no-store' }));
  return (
    <AdminPage
      breadcrumbs={[{ label: t('label'), href: routes.admin }, { label: t('nav.methodologies') }]}
      title={t('impact.title')}
      description={t('impact.description')}
    >
      <MethodologyList items={items} />
    </AdminPage>
  );
}

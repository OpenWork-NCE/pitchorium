import { adminControllerFlags } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { FeatureFlags } from '@/features/admin';
import { asLocale } from '@/i18n/routing';
import { consoleRead } from '@/lib/api/console-read';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.flags');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The feature flags with their guardrail and history. */
export default async function Page({ params }: PageProps<'/[locale]/admin/flags'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  const t = await getTranslations('web.admin');
  const { items } = await consoleRead(adminControllerFlags({ cache: 'no-store' }));
  return (
    <AdminPage
      breadcrumbs={[{ label: t('label'), href: routes.admin }, { label: t('nav.flags') }]}
      title={t('flags.title')}
      description={t('flags.description')}
    >
      <FeatureFlags flags={items} />
    </AdminPage>
  );
}

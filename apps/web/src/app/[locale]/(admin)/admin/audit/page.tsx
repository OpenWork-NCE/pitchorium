import { adminControllerAuditLog } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { AuditLog, auditFiltersOf, auditQueryOf } from '@/features/admin';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.audit');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** The audit log filtered in the address; its reading is itself audited. */
export default async function Page({ params, searchParams }: PageProps<'/[locale]/admin/audit'>) {
  setRequestLocale(asLocale((await params).locale));
  const filters = auditFiltersOf(await searchParams);
  configureServerApi();
  const t = await getTranslations('web.admin');
  const page = await adminControllerAuditLog(
    { ...auditQueryOf(filters), limit: 50 },
    { cache: 'no-store' },
  );
  return (
    <AdminPage
      breadcrumbs={[{ label: t('label'), href: routes.admin }, { label: t('nav.audit') }]}
      title={t('audit.title')}
      description={t('audit.description')}
      audited
    >
      <AuditLog key={JSON.stringify(filters)} page={page} filters={filters} />
    </AdminPage>
  );
}

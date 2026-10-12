import { ApiProblemError, methodologiesControllerGet } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { MethodologyDetail } from '@/features/impact';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.impact');
  return { title: t('version'), robots: { index: false, follow: false } };
}

/** A version of the methodology: editor of a draft, publication, archive. */
export default async function Page({
  params,
}: PageProps<'/[locale]/admin/impact/[methodologyId]'>) {
  const { locale, methodologyId } = await params;
  setRequestLocale(asLocale(locale));
  configureServerApi();
  const t = await getTranslations('web.admin');
  const methodology = await methodologiesControllerGet(methodologyId, {
    cache: 'no-store',
  }).catch((error: unknown) => {
    if (error instanceof ApiProblemError && [400, 404].includes(error.problem.status)) notFound();
    throw error;
  });
  return (
    <AdminPage
      breadcrumbs={[
        { label: t('label'), href: routes.admin },
        { label: t('nav.methodologies'), href: routes.adminMethodologies },
        {
          label: t('impact.versionName', { version: methodology.version, name: methodology.name }),
        },
      ]}
      title={t('impact.versionName', { version: methodology.version, name: methodology.name })}
      description={t(`impact.statusDescription.${methodology.status}`)}
    >
      <MethodologyDetail key={methodology.id} methodology={methodology} />
    </AdminPage>
  );
}

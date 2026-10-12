import {
  ApiProblemError,
  verificationControllerGet,
  verificationControllerQueue,
} from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { VerificationReview } from '@/features/organizations';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.verification');
  return { title: t('request'), robots: { index: false, follow: false } };
}

/** A verification request: declaration, private documents, signal, criteria and decision. */
export default async function Page({
  params,
}: PageProps<'/[locale]/admin/organizations/[requestId]'>) {
  const { locale, requestId } = await params;
  setRequestLocale(asLocale(locale));
  configureServerApi();
  const t = await getTranslations('web.admin');
  const [request, queue] = await Promise.all([
    verificationControllerGet(requestId, { cache: 'no-store' }).catch((error: unknown) => {
      if (error instanceof ApiProblemError && error.problem.status === 404) notFound();
      throw error;
    }),
    // The configured criteria come with the queue.
    verificationControllerQueue({ status: 'pending' }, { cache: 'no-store' }),
  ]);
  return (
    <AdminPage
      breadcrumbs={[
        { label: t('label'), href: routes.admin },
        { label: t('nav.organizations'), href: routes.adminOrganizations },
        { label: request.organization.name },
      ]}
      title={request.organization.name}
      description={t('verification.request')}
      audited
    >
      <VerificationReview request={request} criteria={queue.criteria} />
    </AdminPage>
  );
}

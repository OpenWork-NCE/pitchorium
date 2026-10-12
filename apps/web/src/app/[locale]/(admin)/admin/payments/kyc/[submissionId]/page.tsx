import { ApiProblemError, adminPaymentsControllerKycSubmission } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { KycReview } from '@/features/payments';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.payments.kyc');
  return { title: t('submission'), robots: { index: false, follow: false } };
}

/** An identity verification: the private documents, then a motivated decision. */
export default async function Page({
  params,
}: PageProps<'/[locale]/admin/payments/kyc/[submissionId]'>) {
  const { locale, submissionId } = await params;
  setRequestLocale(asLocale(locale));
  configureServerApi();
  const t = await getTranslations('web.admin');
  const common = await getTranslations('web.admin.common');
  const submission = await adminPaymentsControllerKycSubmission(submissionId, {
    cache: 'no-store',
  }).catch((error: unknown) => {
    if (error instanceof ApiProblemError && [400, 404].includes(error.problem.status)) notFound();
    throw error;
  });
  const name = submission.holder?.displayName ?? common('deletedMember');
  return (
    <AdminPage
      breadcrumbs={[
        { label: t('label'), href: routes.admin },
        { label: t('nav.kyc'), href: routes.adminKyc },
        { label: name },
      ]}
      title={name}
      description={t('payments.kyc.submission')}
      audited
    >
      <KycReview submission={submission} />
    </AdminPage>
  );
}

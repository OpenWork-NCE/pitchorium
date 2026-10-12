import { ApiProblemError, adminPaymentsControllerContribution } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPage } from '@/components/layout/admin/admin-page';
import * as routes from '@/config/paths';
import { AdminContributionDetail } from '@/features/payments';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.admin.payments.contribution');
  return { title: t('title'), robots: { index: false, follow: false } };
}

/** A contribution: quote, ledger, refunds and the refund with its effect; audited. */
export default async function Page({
  params,
}: PageProps<'/[locale]/admin/payments/contributions/[contributionId]'>) {
  const { locale, contributionId } = await params;
  setRequestLocale(asLocale(locale));
  configureServerApi();
  const t = await getTranslations('web.admin');
  const contribution = await adminPaymentsControllerContribution(contributionId, {
    cache: 'no-store',
  }).catch((error: unknown) => {
    if (error instanceof ApiProblemError && [400, 404].includes(error.problem.status)) notFound();
    throw error;
  });
  return (
    <AdminPage
      breadcrumbs={[
        { label: t('label'), href: routes.admin },
        { label: t('nav.contributions'), href: routes.adminContributions },
        { label: contribution.project.title },
      ]}
      title={t('payments.contribution.title')}
      description={contribution.project.title}
      audited
    >
      <AdminContributionDetail contribution={contribution} />
    </AdminPage>
  );
}

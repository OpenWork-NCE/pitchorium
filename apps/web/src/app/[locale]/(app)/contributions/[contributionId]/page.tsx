import { contributionsControllerOne } from '@pitchorium/api-client';
import type { Contribution } from '@pitchorium/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { ContributionDetail, contributionIdFromPath } from '@/features/payments';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.payments.detail');
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/** A contribution of the member (§9.4); 404 for one that is not theirs. */
export default async function Page({
  params,
}: PageProps<'/[locale]/contributions/[contributionId]'>) {
  const { locale, contributionId } = await params;
  setRequestLocale(asLocale(locale));
  const id = contributionIdFromPath(contributionId);
  if (!id) notFound();
  configureServerApi();
  const contribution: Contribution | null = await contributionsControllerOne(id, {
    cache: 'no-store',
  }).catch((): null => null);
  if (!contribution) notFound();
  return (
    <SingleColumnLayout width="prose">
      <ContributionDetail contribution={contribution} />
    </SingleColumnLayout>
  );
}

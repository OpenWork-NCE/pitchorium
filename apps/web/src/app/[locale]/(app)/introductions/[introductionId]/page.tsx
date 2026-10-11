import { ApiProblemError, messagingControllerIntroduction } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { Heading, Link } from '@/components/ui';
import * as routes from '@/config/paths';
import { IntroductionCard } from '@/features/messaging';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.messaging.introductions');
  return { title: t('one'), robots: { index: false, follow: false } };
}

/** One introduction (the link of its notification), to answer it or reach its conversation. */
export default async function Page({
  params,
}: PageProps<'/[locale]/introductions/[introductionId]'>) {
  const { locale, introductionId } = await params;
  setRequestLocale(asLocale(locale));
  if (!UUID.test(introductionId)) notFound();
  const t = await getTranslations('web.messaging.introductions');
  configureServerApi();
  const introduction = await messagingControllerIntroduction(introductionId, {
    cache: 'no-store',
  }).catch((error: unknown) => {
    if (error instanceof ApiProblemError && error.problem.status < 500) return null;
    throw error;
  });
  if (!introduction) notFound();
  return (
    <SingleColumnLayout width="prose">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Link href={routes.introductions} variant="standalone" className="text-sm">
            {t('all')}
          </Link>
          <Heading level={1} size="page">
            {t('one')}
          </Heading>
        </div>
        <ScopedMessages scope="messaging">
          <IntroductionCard introduction={introduction} />
        </ScopedMessages>
      </div>
    </SingleColumnLayout>
  );
}

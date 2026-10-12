import {
  ApiProblemError,
  reportsControllerMine,
  standingControllerRead,
} from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { ModerationSettings } from '@/features/trust';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.settings.sections');
  return { title: t('moderation'), robots: { index: false, follow: false } };
}

/**
 * « Modération » (§13): the decisions that concern the member, their reasons and their appeal,
 * then the reports the member made. Open to a suspended member (ADR 0073, 0166), whose reports
 * the api does not list: the page shows the decisions without them.
 */
export default async function Page({ params }: PageProps<'/[locale]/settings/moderation'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  const [standing, reports] = await Promise.all([
    standingControllerRead({ cache: 'no-store' }),
    reportsControllerMine({ limit: 20 }, { cache: 'no-store' }).catch((error: unknown) => {
      if (error instanceof ApiProblemError && error.problem.code === 'ACCESS_ACCOUNT_SUSPENDED') {
        return null;
      }
      throw error;
    }),
  ]);
  return (
    <ScopedMessages scope="trust">
      <ModerationSettings standing={standing} reports={reports} now={new Date().toISOString()} />
    </ScopedMessages>
  );
}

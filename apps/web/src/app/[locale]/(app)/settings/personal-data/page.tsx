import { privacyControllerOverview } from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ScopedMessages } from '@/components/layout/scoped-messages';
import { PersonalDataSettings } from '@/features/privacy';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { firstParam } from '@/lib/search-params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.settings.sections');
  return { title: t('personalData'), robots: { index: false, follow: false } };
}

/**
 * « Données personnelles » (§13): the export of the data and the deletion of the account. Open to
 * a suspended member and to one who has not accepted the new terms (ADR 0073, ADR 0074).
 */
export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/settings/personal-data'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  const [overview, query] = await Promise.all([
    privacyControllerOverview({ cache: 'no-store' }),
    searchParams,
  ]);
  return (
    <ScopedMessages scope="privacy">
      <PersonalDataSettings initial={overview} erase={firstParam(query, 'erase') === '1'} />
    </ScopedMessages>
  );
}

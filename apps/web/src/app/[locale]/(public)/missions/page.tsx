import {
  missionsControllerList,
  missionsControllerMine,
  missionsControllerMyEngagements,
  missionsControllerPublicList,
  profilesControllerReferenceData,
} from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import {
  MISSIONS_PAGE_SIZE,
  MissionsList,
  missionsApiQuery,
  myEngagementsQuery,
  readMissionFilters,
} from '@/features/missions';
import { languageOptions } from '@/features/profiles';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { countryOptions } from '@/lib/format/countries';
import { resourceMetadata } from '@/lib/resources/metadata';

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/[locale]/missions'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('web.missions.list');
  const member = await getCurrentMember();
  const metadata = await resourceMetadata(
    asLocale(locale),
    routes.missions,
    { view: member ? 'member' : 'visitor', data: null },
    t('title'),
  );
  const { tab } = await searchParams;
  return {
    ...metadata,
    description: t('description'),
    ...(tab ? { robots: { index: false, follow: false } } : {}),
  };
}

/**
 * The missions of skills sponsorship (§6.3, §14), public and the same address for a member: the
 * open offers and requests, and a member's own missions and engagements; filters in the address.
 */
export default async function Page({ params, searchParams }: PageProps<'/[locale]/missions'>) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations('web.missions.list');
  const reference = await getTranslations('reference');
  configureServerApi();
  const member = await getCurrentMember();
  const signedIn = member !== null;
  const filters = readMissionFilters(await searchParams, signedIn);
  const options = { cache: 'no-store' } as const;
  const [data, missions, engagements] = await Promise.all([
    profilesControllerReferenceData(options).catch(() => null),
    filters.tab === 'engagements'
      ? Promise.resolve(null)
      : (filters.tab === 'mine'
          ? missionsControllerMine({ limit: MISSIONS_PAGE_SIZE }, options)
          : signedIn
            ? missionsControllerList(missionsApiQuery(filters), options)
            : missionsControllerPublicList(missionsApiQuery(filters), options)
        ).catch(() => null),
    filters.tab === 'engagements'
      ? missionsControllerMyEngagements(myEngagementsQuery(filters), options).catch(() => null)
      : Promise.resolve(null),
  ]);
  const sectors = (data?.sectors ?? []).map(({ code }) => ({
    value: code,
    label: reference.has(`sectorsShort.${code}` as never)
      ? reference(`sectorsShort.${code}` as never)
      : reference(`sectors.${code}` as never),
  }));
  return (
    <SingleColumnLayout>
      <div className="grid gap-8">
        <header className="grid max-w-prose gap-2">
          <Heading level={1} size="page">
            {t('title')}
          </Heading>
          <Text tone="muted">{t('lede')}</Text>
        </header>
        <MissionsList
          filters={filters}
          missions={missions}
          engagements={engagements}
          signedIn={signedIn}
          viewerHandle={member?.profile.handle ?? null}
          countries={countryOptions(
            (data?.countries ?? []).map((country) => country.code),
            locale,
          )}
          sectors={sectors}
          languages={languageOptions(locale)}
        />
      </div>
    </SingleColumnLayout>
  );
}

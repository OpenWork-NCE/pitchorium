import {
  eventsControllerList,
  eventsControllerMine,
  eventsControllerPublicList,
  profilesControllerReferenceData,
} from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { EventsList, eventsApiQuery, myEventsQuery, readEventFilters } from '@/features/events';
import { languageOptions } from '@/features/profiles';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { countryOptions } from '@/lib/format/countries';
import { resourceMetadata } from '@/lib/resources/metadata';

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/[locale]/events'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('web.events.list');
  const member = await getCurrentMember();
  const metadata = await resourceMetadata(
    asLocale(locale),
    routes.events,
    { view: member ? 'member' : 'visitor', data: null },
    t('title'),
  );
  // « Mes événements » is a member's own view, never indexed.
  const { tab } = await searchParams;
  return {
    ...metadata,
    description: t('description'),
    ...(tab === 'mine' ? { robots: { index: false, follow: false } } : {}),
  };
}

/**
 * The events (§14), public and indexable, the same address in the member space (ADR 0101):
 * upcoming and past ones, a member's own (registered or organized); the filters in the address,
 * each set rendered by the server.
 */
export default async function Page({ params, searchParams }: PageProps<'/[locale]/events'>) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations('web.events.list');
  const reference = await getTranslations('reference');
  configureServerApi();
  const member = await getCurrentMember();
  const signedIn = member !== null;
  const filters = readEventFilters(await searchParams, signedIn);
  const options = { cache: 'no-store' } as const;
  const [data, page] = await Promise.all([
    profilesControllerReferenceData(options).catch(() => null),
    (filters.tab === 'mine'
      ? eventsControllerMine(myEventsQuery(filters), options)
      : signedIn
        ? eventsControllerList(eventsApiQuery(filters), options)
        : eventsControllerPublicList(eventsApiQuery(filters), options)
    ).catch(() => null),
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
        <EventsList
          filters={filters}
          page={page}
          signedIn={signedIn}
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

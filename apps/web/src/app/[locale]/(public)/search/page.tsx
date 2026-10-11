import {
  discoveryControllerSearchAsMember,
  discoveryControllerSearchAsVisitor,
  methodologiesControllerPublished,
  profilesControllerReferenceData,
} from '@pitchorium/api-client';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SingleColumnLayout } from '@/components/layout/page-layouts';
import { Heading, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import {
  readSearchFilters,
  SearchBrowser,
  searchApiQuery,
  SearchResults,
} from '@/features/discovery';
import { languageOptions } from '@/features/profiles';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';
import { getCurrentMember } from '@/lib/auth/session';
import { countryOptions } from '@/lib/format/countries';
import { resourceMetadata } from '@/lib/resources/metadata';

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/[locale]/search'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('web.search.page');
  const member = await getCurrentMember();
  const metadata = await resourceMetadata(
    asLocale(locale),
    routes.search,
    { view: member ? 'member' : 'visitor', data: null },
    t('title'),
  );
  // A page of results of a query is never indexed: only the empty search page is (FRONT 7).
  const query = await searchParams;
  const results = Object.keys(query).length > 0;
  return {
    ...metadata,
    description: t('description'),
    ...(results ? { robots: { index: false, follow: true } } : {}),
  };
}

/**
 * Results of the global search (§10.6), one address for visitors and members (ADR 0101): the
 * query, the kind and the filters are in the address, each set rendered by the server; a visitor
 * searches what is public, a member what members see (ADR 0066).
 */
export default async function Page({ params, searchParams }: PageProps<'/[locale]/search'>) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations('web.search.page');
  const reference = await getTranslations('reference');
  const filters = readSearchFilters(await searchParams);
  configureServerApi();
  const member = await getCurrentMember();
  const signedIn = member !== null;
  const options = { cache: 'no-store' } as const;
  const [methodology, data] = await Promise.all([
    methodologiesControllerPublished(options).catch(() => null),
    profilesControllerReferenceData(options).catch(() => null),
  ]);
  const impactAvailable = methodology !== null;
  const searching = filters.q !== '' || filters.type !== 'all';
  const search = signedIn ? discoveryControllerSearchAsMember : discoveryControllerSearchAsVisitor;
  const page = searching
    ? await search(searchApiQuery(filters, { impactAvailable }), options).catch(() => null)
    : undefined;
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
            {filters.q ? t('titleFor', { query: filters.q }) : t('title')}
          </Heading>
          <Text tone="muted">{signedIn ? t('lede') : t('ledeVisitor')}</Text>
        </header>
        <SearchBrowser
          countries={countryOptions(
            (data?.countries ?? []).map((country) => country.code),
            locale,
          )}
          sectors={sectors}
          languages={languageOptions(locale)}
          impactAvailable={impactAvailable}
        >
          {page === undefined ? (
            <Text tone="muted">{t('start')}</Text>
          ) : (
            <SearchResults
              filters={filters}
              page={page}
              signedIn={signedIn}
              impactAvailable={impactAvailable}
            />
          )}
        </SearchBrowser>
      </div>
    </SingleColumnLayout>
  );
}

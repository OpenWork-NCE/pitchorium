import type { DiscoveryCard } from '@pitchorium/contracts';
import { SearchX } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button, EmptyState, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import { pluralOf } from '@/lib/i18n/plural-of';
import { broaderSearch, type SearchFilters, searchHref } from '../lib/search-query';
import { ResultCard } from './result-card';
import { ResultsMore } from './search-more';

/**
 * The results of a search (§10.6), first page rendered by the server; nothing found says so with a
 * broader search to run and the ways to discover instead (FRONT 7).
 */
export async function SearchResults({
  filters,
  page,
  signedIn,
  impactAvailable,
}: {
  filters: SearchFilters;
  page: { items: DiscoveryCard[]; nextCursor: string | null } | null;
  signedIn: boolean;
  impactAvailable: boolean;
}) {
  const t = await getTranslations('web.search.page');
  const locale = await getLocale();
  if (page === null) {
    return <EmptyState size="page" title={t('error')} description={t('errorBody')} />;
  }
  if (page.items.length === 0) {
    const broader = broaderSearch(filters);
    return (
      <EmptyState
        icon={<SearchX />}
        title={filters.q ? t('empty', { query: filters.q }) : t('emptyFiltered')}
        description={t('emptyBody')}
        action={
          <div className="grid justify-items-center gap-4">
            {broader ? (
              <Button asChild>
                <Link href={searchHref(routes.search, broader)}>
                  {broader.q && broader.q !== filters.q
                    ? t('broaderQuery', { query: broader.q })
                    : t('broader')}
                </Link>
              </Button>
            ) : null}
            <nav aria-label={t('elsewhere')} className="grid justify-items-center gap-2">
              <Text size="sm" tone="muted">
                {t('elsewhere')}
              </Text>
              <ul className="flex flex-wrap justify-center gap-2">
                {(
                  [
                    [routes.discover, 'discover'],
                    [routes.projects, 'projects'],
                    [routes.events, 'events'],
                    [routes.missions, 'missions'],
                  ] as const
                ).map(([href, key]) => (
                  <li key={key}>
                    <Button asChild variant="outline" size="sm">
                      <Link href={href}>{t(`links.${key}`)}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        }
      />
    );
  }
  return (
    <div className="grid gap-6">
      <p className="sr-only" role="status">
        {t(`shown.${pluralOf(locale, page.items.length)}`, { count: page.items.length })}
      </p>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {page.items.map((card) => (
          <li key={`${card.kind}:${card.key}`} className="grid">
            <ResultCard card={card} headingLevel={2} />
          </li>
        ))}
      </ul>
      <ResultsMore
        source={{ kind: 'search', filters, impactAvailable }}
        cursor={page.nextCursor}
        signedIn={signedIn}
        shown={page.items.length}
      />
    </div>
  );
}

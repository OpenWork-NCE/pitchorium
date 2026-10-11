'use client';

import type { DiscoveryCard } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Pagination } from '@/components/ui';
import type { DiscoverSection } from '../lib/kinds';
import { type SearchFilters, searchApiQuery } from '../lib/search-query';
import { ResultCard } from './result-card';

type Source =
  | { kind: 'search'; filters: SearchFilters; impactAvailable: boolean }
  | { kind: 'section'; section: DiscoverSection };

/**
 * The next pages of results or of a section, after the first one rendered by the server (cursor
 * of the api): appended under it, the end announced.
 */
export function ResultsMore({
  source,
  cursor: first,
  signedIn,
  shown,
}: {
  source: Source;
  cursor: string | null;
  signedIn: boolean;
  shown: number;
}) {
  const t = useTranslations('web.search.page');
  const [cards, setCards] = useState<DiscoveryCard[]>([]);
  const [cursor, setCursor] = useState(first);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function more() {
    if (!cursor) return;
    setLoading(true);
    setFailed(false);
    try {
      const { fetchSearchPage, fetchSectionPage } = await import('./search-fetch');
      const page =
        source.kind === 'search'
          ? await fetchSearchPage(
              searchApiQuery(source.filters, { impactAvailable: source.impactAvailable, cursor }),
              signedIn,
            )
          : await fetchSectionPage(source.section, cursor, signedIn);
      setCards((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {cards.length > 0 ? (
        <ul className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li key={`${card.kind}:${card.key}`} className="grid">
              <ResultCard card={card} headingLevel={2} />
            </li>
          ))}
        </ul>
      ) : null}
      <Pagination
        hasMore={cursor !== null}
        loading={loading}
        onLoadMore={() => void more()}
        shown={shown + cards.length}
      />
      {failed ? (
        <p role="alert" className="text-center text-sm text-danger">
          {t('moreError')}
        </p>
      ) : null}
    </>
  );
}

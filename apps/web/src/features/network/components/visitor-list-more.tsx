'use client';

import { ApiProblemError } from '@pitchorium/api-client';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert, Pagination } from '@/components/ui';
import { configureBrowserApi } from '@/lib/api/browser';
import {
  type VisitorFollowType,
  type VisitorListEntry,
  type VisitorListTab,
  visitorListPage,
} from '../lib/visitor-lists';
import { NetworkRow } from './network-row';

configureBrowserApi();

const SINCE = {
  connections: 'connectedSince',
  followers: 'followerSince',
  following: 'followingSince',
} as const;

/**
 * The next pages of a list read by a visitor, appended under the first one the server rendered,
 * with a plain request: neither TanStack Query nor the URL state in the first load of a public
 * page (ADR 0094).
 */
export function VisitorListMore({
  handle,
  tab,
  type,
  cursor: first,
  shown: initiallyShown,
}: {
  handle: string;
  tab: VisitorListTab;
  type: VisitorFollowType;
  cursor: string | null;
  shown: number;
}) {
  const t = useTranslations('web.network.lists');
  const errors = useTranslations('errors');
  const format = useFormatter();
  const [entries, setEntries] = useState<VisitorListEntry[]>([]);
  const [cursor, setCursor] = useState(first);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    setFailure(null);
    try {
      const page = await visitorListPage(handle, tab, type, cursor);
      setEntries((current) => [...current, ...page.entries]);
      setCursor(page.nextCursor);
    } catch (error) {
      const code = error instanceof ApiProblemError ? error.problem.code : 'INTERNAL_ERROR';
      setFailure(errors.has(code as never) ? errors(code as never) : errors('INTERNAL_ERROR'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {entries.length > 0 ? (
        <ul className="grid gap-1" aria-label={t(`tabs.${tab}`)}>
          {entries.map((entry) => (
            <NetworkRow
              key={entry.item.key}
              item={entry.item}
              meta={t(SINCE[tab], {
                date: format.dateTime(new Date(entry.since), { dateStyle: 'medium' }),
              })}
            />
          ))}
        </ul>
      ) : null}
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <Pagination
        hasMore={cursor !== null}
        loading={loading}
        shown={initiallyShown + entries.length}
        onLoadMore={() => void loadMore()}
      />
    </>
  );
}

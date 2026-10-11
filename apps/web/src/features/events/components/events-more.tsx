'use client';

import type { EventCard as EventCardData } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Pagination } from '@/components/ui';
import type { EventFilters } from '../lib/events-query';
import { EventCard } from './event-card';

/** The next pages of the list, after the first one rendered by the server. */
export function EventsMore({
  filters,
  cursor: first,
  signedIn,
  shown,
}: {
  filters: EventFilters;
  cursor: string | null;
  signedIn: boolean;
  shown: number;
}) {
  const t = useTranslations('web.events.list');
  const [events, setEvents] = useState<EventCardData[]>([]);
  const [cursor, setCursor] = useState(first);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function more() {
    if (!cursor) return;
    setLoading(true);
    setFailed(false);
    try {
      const { fetchEventsPage } = await import('./events-fetch');
      const page = await fetchEventsPage(filters, cursor, signedIn);
      setEvents((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {events.length > 0 ? (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <li key={event.id} className="grid">
              <EventCard event={event} />
            </li>
          ))}
        </ul>
      ) : null}
      <Pagination
        hasMore={cursor !== null}
        loading={loading}
        onLoadMore={() => void more()}
        shown={shown + events.length}
      />
      {failed ? (
        <p role="alert" className="text-center text-sm text-danger">
          {t('moreError')}
        </p>
      ) : null}
    </>
  );
}

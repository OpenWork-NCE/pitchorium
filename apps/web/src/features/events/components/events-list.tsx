import type { EventCard as EventCardData } from '@pitchorium/contracts';
import { CalendarPlus, CalendarSearch } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button, EmptyState } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import { type EventFilters, isFiltered } from '../lib/events-query';
import { EventCard } from './event-card';
import { EventsBrowser } from './events-browser';
import { EventsMore } from './events-more';

interface Option {
  value: string;
  label: string;
}

/**
 * The events (§14), public and indexable: upcoming and past ones, a member's own; filters in the
 * address, first page by the server, the next ones on demand; each empty view says why.
 */
export async function EventsList({
  filters,
  page,
  signedIn,
  countries,
  sectors,
  languages,
}: {
  filters: EventFilters;
  page: { items: EventCardData[]; nextCursor: string | null } | null;
  signedIn: boolean;
  countries: readonly Option[];
  sectors: readonly Option[];
  languages: readonly Option[];
}) {
  const t = await getTranslations('web.events.list');
  const create = signedIn ? (
    <Button asChild>
      <Link href={routes.createEvent}>
        <CalendarPlus aria-hidden />
        {t('create')}
      </Link>
    </Button>
  ) : undefined;
  const empty =
    filters.tab === 'mine'
      ? `mine.${filters.role}`
      : isFiltered(filters)
        ? 'filtered'
        : filters.tab;
  return (
    <EventsBrowser
      signedIn={signedIn}
      countries={countries}
      sectors={sectors}
      languages={languages}
    >
      {page === null ? (
        <EmptyState size="page" title={t('error')} description={t('errorBody')} />
      ) : page.items.length === 0 ? (
        <EmptyState
          icon={<CalendarSearch />}
          title={t(`empty.${empty}.title` as never)}
          description={t(`empty.${empty}.body` as never)}
          action={filters.tab === 'past' || empty === 'filtered' ? undefined : create}
        />
      ) : (
        <div className="grid gap-6">
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {page.items.map((event) => (
              <li key={event.id} className="grid">
                <EventCard event={event} />
              </li>
            ))}
          </ul>
          <EventsMore
            filters={filters}
            cursor={page.nextCursor}
            signedIn={signedIn}
            shown={page.items.length}
          />
        </div>
      )}
    </EventsBrowser>
  );
}

import {
  eventsControllerList,
  eventsControllerMine,
  eventsControllerPublicList,
} from '@pitchorium/api-client';
import { configureBrowserApi } from '@/lib/api/browser';
import { type EventFilters, eventsApiQuery, myEventsQuery } from '../lib/events-query';

configureBrowserApi();

/** A next page of the list, loaded at the first « Voir plus » only (ADR 0094). */
export function fetchEventsPage(filters: EventFilters, cursor: string, signedIn: boolean) {
  if (filters.tab === 'mine') return eventsControllerMine(myEventsQuery(filters, cursor));
  const query = eventsApiQuery(filters, cursor);
  return signedIn ? eventsControllerList(query) : eventsControllerPublicList(query);
}

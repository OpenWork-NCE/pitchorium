import {
  missionsControllerList,
  missionsControllerMine,
  missionsControllerMyEngagements,
  missionsControllerPublicList,
} from '@pitchorium/api-client';
import { configureBrowserApi } from '@/lib/api/browser';
import {
  type MissionFilters,
  MISSIONS_PAGE_SIZE,
  missionsApiQuery,
  myEngagementsQuery,
} from '../lib/missions-query';

configureBrowserApi();

/** A next page of missions, loaded at the first « Voir plus » only (ADR 0094). */
export function fetchMissionsPage(filters: MissionFilters, cursor: string, signedIn: boolean) {
  if (filters.tab === 'mine') return missionsControllerMine({ limit: MISSIONS_PAGE_SIZE, cursor });
  const query = missionsApiQuery(filters, cursor);
  return signedIn ? missionsControllerList(query) : missionsControllerPublicList(query);
}

/** A next page of the member's engagements. */
export function fetchEngagementsPage(filters: MissionFilters, cursor: string) {
  return missionsControllerMyEngagements(myEngagementsQuery(filters, cursor));
}

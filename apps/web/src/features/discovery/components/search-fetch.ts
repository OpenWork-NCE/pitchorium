import {
  discoveryControllerPublicSection,
  discoveryControllerSearchAsMember,
  discoveryControllerSearchAsVisitor,
  discoveryControllerSection,
} from '@pitchorium/api-client';
import type { DiscoveryControllerSearchAsMemberParams } from '@pitchorium/api-client';
import { configureBrowserApi } from '@/lib/api/browser';
import type { DiscoverSection } from '../lib/kinds';

configureBrowserApi();

/**
 * A next page of results or of a section of « Découvrir », loaded at the first « Voir plus »
 * only: a visitor's first load never carries the client of the api (ADR 0094).
 */
export function fetchSearchPage(query: DiscoveryControllerSearchAsMemberParams, signedIn: boolean) {
  return signedIn
    ? discoveryControllerSearchAsMember(query)
    : discoveryControllerSearchAsVisitor(query);
}

export function fetchSectionPage(section: DiscoverSection, cursor: string, signedIn: boolean) {
  const query = { limit: 12, cursor };
  return signedIn
    ? discoveryControllerSection(section, query)
    : discoveryControllerPublicSection(section, query);
}

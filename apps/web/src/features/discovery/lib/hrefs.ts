import type { DiscoveryKind } from './kinds';
import * as routes from '@/config/paths';

/** The page of a result of the search, by kind: its key is a handle, a slug or an identifier. */
export function resultHref(kind: DiscoveryKind, key: string): string {
  switch (kind) {
    case 'person':
      return routes.member(key);
    case 'organization':
      return routes.organization(key);
    case 'project':
      return routes.project(key);
    case 'event':
      return routes.event(key);
    case 'mission':
      return routes.mission(key);
  }
}

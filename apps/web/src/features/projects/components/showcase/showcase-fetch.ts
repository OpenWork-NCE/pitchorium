import {
  projectsControllerPublicShowcase,
  projectsControllerShowcase,
} from '@pitchorium/api-client';
import type { ProjectsControllerShowcaseParams } from '@pitchorium/api-client';
import { configureBrowserApi } from '@/lib/api/browser';

configureBrowserApi();

/**
 * A next page of the showcase, loaded at the first « Voir plus » only: a visitor's first load
 * never carries the client of the api (ADR 0094). A member reads the member list.
 */
export function fetchShowcasePage(query: ProjectsControllerShowcaseParams, signedIn: boolean) {
  return signedIn ? projectsControllerShowcase(query) : projectsControllerPublicShowcase(query);
}

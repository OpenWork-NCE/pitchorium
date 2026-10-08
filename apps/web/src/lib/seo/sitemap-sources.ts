import 'server-only';
import {
  eventsControllerPublicList,
  projectsControllerPublicShowcase,
} from '@pitchorium/api-client';
import { routes } from '@/config/routes';
import { configureServerApi } from '@/lib/api/server';

/** Pages read per source: 100 items each, 2 000 addresses at most per kind. */
const MAX_PAGES = 20;

/** Every item of a paginated public list, page after page; what could be read on a failure. */
async function every<T>(
  read: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor: string | null }>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await read(cursor);
      items.push(...result.items);
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }
  } catch {
    // The sitemap keeps its other addresses; the next crawl reads again.
  }
  return items;
}

/**
 * Addresses of the public pages of resources (ADR 0101), from the public lists of the api: the
 * projects of the showcase and the public events. Profiles and organisations have no public list
 * yet (docs/open-questions.md, 104).
 */
export const PUBLIC_SITEMAP_SOURCES: (() => Promise<string[]>)[] = [
  async () => {
    configureServerApi();
    const projects = await every((cursor) =>
      projectsControllerPublicShowcase({ limit: 100, ...(cursor ? { cursor } : {}) }),
    );
    return projects.map((project) => routes.project(project.slug));
  },
  async () => {
    configureServerApi();
    const events = await every((cursor) =>
      eventsControllerPublicList({ limit: 100, ...(cursor ? { cursor } : {}) }),
    );
    return events.map((event) => routes.event(event.slug));
  },
];

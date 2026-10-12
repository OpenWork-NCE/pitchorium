import 'server-only';
import {
  eventsControllerPublicList,
  organizationsControllerPublicPages,
  profilesControllerPublicPages,
  projectsControllerPublicShowcase,
} from '@pitchorium/api-client';
import * as routes from '@/config/paths';
import { configureServerApi, sharedRead } from '@/lib/api/server';

/** Pages read per source: 100 items each, 2 000 addresses at most per kind. */
const MAX_PAGES = 20;

/** A crawler reads the sitemap often: each page of a public list is kept an hour (sharedRead). */
const LIST = sharedRead(3600);

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
 * projects of the showcase, the public events, the profiles whose owner opened the public page,
 * the organisations. A member view is never listed.
 */
export const PUBLIC_SITEMAP_SOURCES: (() => Promise<string[]>)[] = [
  async () => {
    configureServerApi();
    const projects = await every((cursor) =>
      projectsControllerPublicShowcase({ limit: 100, ...(cursor ? { cursor } : {}) }, LIST),
    );
    return projects.map((project) => routes.project(project.slug));
  },
  async () => {
    configureServerApi();
    const events = await every((cursor) =>
      eventsControllerPublicList({ limit: 100, ...(cursor ? { cursor } : {}) }, LIST),
    );
    return events.map((event) => routes.event(event.slug));
  },
  async () => {
    configureServerApi();
    const profiles = await every((cursor) =>
      profilesControllerPublicPages({ limit: 100, ...(cursor ? { cursor } : {}) }, LIST),
    );
    return profiles.map((profile) => routes.member(profile.handle));
  },
  async () => {
    configureServerApi();
    const organizations = await every((cursor) =>
      organizationsControllerPublicPages({ limit: 100, ...(cursor ? { cursor } : {}) }, LIST),
    );
    return organizations.map((organization) => routes.organization(organization.slug));
  },
];

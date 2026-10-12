/** The kinds of pages a notice without an account can point to (a message never can). */
export type NoticeTarget =
  | { type: 'profile'; key: string }
  | { type: 'organization'; key: string }
  | { type: 'post'; key: string }
  | { type: 'project'; key: string }
  | { type: 'event'; key: string }
  | { type: 'mission'; key: string };

const SEGMENTS: Record<string, NoticeTarget['type']> = {
  members: 'profile',
  organizations: 'organization',
  posts: 'post',
  projects: 'project',
  events: 'event',
  missions: 'mission',
};

/** Pages of a section that are not a resource (`/projects/new`, `/missions/engagements/…`). */
const RESERVED = new Set(['new', 'engagements']);

/**
 * The resource a pasted address points to, from its path only: `/{locale}/{section}/{key}`, the
 * locale optional, on the site of the given origin or as a path. Null for any other address. The
 * api says afterwards whether the resource exists and is public.
 */
export function noticeTargetOf(input: string, siteOrigin: string): NoticeTarget | null {
  let url: URL;
  try {
    url = new URL(input.trim(), siteOrigin);
  } catch {
    return null;
  }
  if (url.origin !== new URL(siteOrigin).origin) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length > 0 && /^[a-z]{2}$/.test(parts[0] ?? '')) parts.shift();
  if (parts.length !== 2) return null;
  const [section, key] = parts as [string, string];
  const type = SEGMENTS[section];
  if (!type || RESERVED.has(key)) return null;
  return { type, key: decodeURIComponent(key) };
}

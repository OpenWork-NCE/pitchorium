/**
 * Paths of the web app, without the locale prefix: in English for every locale, never translated
 * (ADR 0092), so that only the prefix changes with the language. The member space and the
 * administration are listed by their first segment: the proxy only checks that a session cookie
 * is present there, the api remains the authority (ADR 0015). A test keeps these lists in line
 * with the folders of `(app)` and `(admin)`.
 */
export const routes = {
  home: '/',
  signIn: '/sign-in',
  health: '/health',
  // Member space (§6.1): the sections of the header.
  feed: '/feed',
  network: '/network',
  projects: '/projects',
  /** The projects the member follows: a view of the showcase (the right column of a wide screen). */
  followedProjects: '/projects?view=followed',
  messages: '/messages',
  notifications: '/notifications',
  profile: '/profile',
  settings: '/settings',
  // Pages of a resource, one address for visitors and members.
  project: (slug: string) => `/projects/${encodeURIComponent(slug)}`,
  member: (handle: string) => `/members/${encodeURIComponent(handle)}`,
  organization: (slug: string) => `/organizations/${encodeURIComponent(slug)}`,
  // Contextual actions of the header, opened by their section (PROMPT FRONT 3 and 4).
  compose: '/feed?compose=1',
  createProject: '/projects?create=1',
  // Administration (ADR 0078): `/admin/<domain>`.
  admin: '/admin',
  adminModeration: '/admin/moderation',
  adminMembers: '/admin/members',
  adminFlags: '/admin/flags',
} as const;

export const MEMBER_SEGMENTS = [
  'feed',
  'network',
  'projects',
  'messages',
  'notifications',
  'profile',
  'settings',
] as const;

export const ADMIN_SEGMENTS = ['admin'] as const;

/** Name of the Better Auth session cookie, with the `__Secure-` prefix over HTTPS. */
export const SESSION_COOKIES = ['pitchorium.session_token', '__Secure-pitchorium.session_token'];

/** True when the path (without locale) belongs to the member space or the administration. */
export function requiresSession(pathname: string): boolean {
  const segment = pathname.split('/')[1] ?? '';
  return (
    (MEMBER_SEGMENTS as readonly string[]).includes(segment) ||
    (ADMIN_SEGMENTS as readonly string[]).includes(segment)
  );
}

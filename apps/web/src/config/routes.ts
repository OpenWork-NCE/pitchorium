/**
 * The member space and the administration are listed by their first segment: the proxy only checks
 * that a session cookie is present there, the api remains the authority (ADR 0015). A test keeps
 * these lists in line with the folders of `(app)` and `(admin)`. The paths themselves are in
 * `paths.ts`, one export each.
 */
export const MEMBER_SEGMENTS = [
  'contributions',
  'dashboard',
  'feed',
  'introductions',
  'network',
  'messages',
  'notifications',
  'profile',
  'saved',
  'settings',
] as const;

export const ADMIN_SEGMENTS = ['admin'] as const;

/** Pages of the authentication group that need a session: the onboarding and its entry. */
export const SIGNED_IN_AUTH_SEGMENTS = ['onboarding', 'continue'] as const;

/** Name of the Better Auth session cookie, with the `__Secure-` prefix over HTTPS. */
export const SESSION_COOKIES = ['pitchorium.session_token', '__Secure-pitchorium.session_token'];

/** True when the path (without locale) belongs to the member space or the administration. */
export function requiresSession(pathname: string): boolean {
  const segment = pathname.split('/')[1] ?? '';
  return (
    (MEMBER_SEGMENTS as readonly string[]).includes(segment) ||
    (ADMIN_SEGMENTS as readonly string[]).includes(segment) ||
    (SIGNED_IN_AUTH_SEGMENTS as readonly string[]).includes(segment)
  );
}

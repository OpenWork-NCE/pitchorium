/**
 * Paths of the web app, without the locale prefix. The member space and the administration are
 * listed by their first segment: the proxy only checks that a session cookie is present there,
 * the api remains the authority (ADR 0015). A test keeps these lists in line with the folders of
 * `(app)` and `(admin)`.
 */
export const routes = {
  home: '/',
  signIn: '/sign-in',
  health: '/health',
} as const;

export const MEMBER_SEGMENTS = [
  'feed',
  'network',
  'messages',
  'notifications',
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

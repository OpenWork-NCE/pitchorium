/** Query parameter carrying the page to return to after a sign-in (same origin only). */
export const REDIRECT_PARAM = 'redirectTo';

/** A backslash or a control character: some browsers read them as a slash or drop them. */
function hasUnsafeCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (character === '\\' || code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * The path to return to after a sign-in, or the fallback (protection against open redirects):
 * only a path of this origin (`/fr/projects?x=1#y`), never a scheme (`https:`, `javascript:`),
 * a protocol-relative address (`//evil.example`), a backslash or a control character.
 */
export function safeRedirect(value: string | null | undefined, fallback: string): string {
  if (!value || value.length > 2048 || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }
  if (hasUnsafeCharacter(value)) return fallback;
  const base = 'https://pitchorium.invalid';
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return fallback;
  }
  if (url.origin !== base) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** A path of the web app with the return address in its query, when there is one. */
export function withRedirect(path: string, redirectTo: string | null | undefined): string {
  if (!redirectTo) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${REDIRECT_PARAM}=${encodeURIComponent(redirectTo)}`;
}

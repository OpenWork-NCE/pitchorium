/**
 * Pseudo-localization of the interface, for the tests only (`e2e/audit`): with
 * `WEB_PSEUDO_LOCALIZATION=true`, every message of every locale is 40 % longer, accented and
 * framed by brackets (`pseudoLocalize` of `@pitchorium/i18n`). Never an active locale: the variable
 * is read on the server only, ignored here and refused by `src/lib/env.ts` for a site that is not
 * served from this machine.
 */
export function pseudoLocalization(): boolean {
  return (
    process.env.WEB_PSEUDO_LOCALIZATION === 'true' &&
    isLocalOrigin(process.env.NEXT_PUBLIC_SITE_URL ?? '')
  );
}

/** An origin of this machine (`localhost`, `127.0.0.1`): the only sites that may pseudo-localize. */
export function isLocalOrigin(url: string): boolean {
  if (!URL.canParse(url)) return false;
  const { hostname } = new URL(url);
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

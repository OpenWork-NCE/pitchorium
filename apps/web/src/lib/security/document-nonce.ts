/** The nonce of the document, read once from its scripts; undefined on the server. */
let cached: string | undefined | null = null;

/**
 * Nonce of the Content Security Policy of the document the browser loaded (ADR 0088), for the
 * styles a library inserts (scroll lock of the overlays, viewport of a Select, the cropper). A
 * client navigation renders the server components again with the nonce of its own request,
 * which the policy of the document does not know: the document's own one is the right one.
 */
export function documentNonce(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  if (cached === null) {
    cached = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce || undefined;
  }
  return cached;
}

'use client';

import { setNonce } from 'get-nonce';
import { documentNonce } from '@/lib/security/document-nonce';

/**
 * Gives the CSP nonce of the document to the style that the scroll lock of the modal overlays
 * inserts (Radix Dialog, through react-remove-scroll and get-nonce): without it, the policy
 * would block that style (ADR 0088). Set during the render, before any overlay opens. The nonce
 * of the document, not the one of the request: after a client navigation, the server renders
 * this component again with the nonce of its own request, unknown to the policy of the page.
 */
export function StyleNonce({ nonce }: { nonce: string | undefined }) {
  const current = documentNonce() ?? nonce;
  if (current) setNonce(current);
  return null;
}

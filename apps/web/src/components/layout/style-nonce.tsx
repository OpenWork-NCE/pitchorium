'use client';

import { setNonce } from 'get-nonce';

/**
 * Gives the CSP nonce of the request to the style that the scroll lock of the modal overlays
 * inserts (Radix Dialog, through react-remove-scroll and get-nonce): without it, the policy
 * would block that style (ADR 0088). Set during the render, before any overlay opens.
 */
export function StyleNonce({ nonce }: { nonce: string | undefined }) {
  if (nonce) setNonce(nonce);
  return null;
}

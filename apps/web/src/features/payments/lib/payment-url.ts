/**
 * The hosted page a contribution sends the browser to (ADR 0136): an address of the api only,
 * accepted when it is HTTPS (Stripe Checkout, Flutterwave Standard) or on the origin of the api
 * itself (the simulated provider of development and tests). Anything else is refused rather than
 * followed: no `javascript:`, no plain HTTP elsewhere.
 */
export function safePaymentUrl(url: string | null, apiUrl: string): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol === 'https:') return parsed.toString();
  return parsed.origin === new URL(apiUrl).origin ? parsed.toString() : null;
}

/** A contribution id read from the return address: a UUID, nothing else is trusted from it. */
export function contributionIdFromPath(raw: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
    ? raw.toLowerCase()
    : null;
}

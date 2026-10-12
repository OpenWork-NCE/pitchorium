/** What replaces a value that could carry personal or secret data. */
export const REDACTED = '[redacted]';

/** Keys whose values are never shown, whatever they hold. */
const SENSITIVE_KEY =
  /mail|phone|mobile|name|password|token|secret|iban|account|card|address|text|body|message|statement|note|reason|detail|url|link|^ip$|signature|cookie|contact|answer|description/i;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;
/** A code: an event type, a kind, a status, a currency, a locale. */
const CODE = /^[a-z0-9][a-z0-9_.:-]{0,63}$/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const ADDRESS = /https?:\/\/\S+/g;

const MAX_DEPTH = 6;
const MAX_ITEMS = 20;
const MAX_REASON = 500;

/**
 * The payload of a failed job as the console shows it (ADR 0172): its structure, identifiers,
 * dates, numbers and codes, never a text, an address, a name or a secret. A value under a
 * sensitive key, and any string that is not an identifier, a date or a code, is redacted.
 */
export function maskJobData(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    return UUID.test(value) || ISO_INSTANT.test(value) || CODE.test(value) ? value : REDACTED;
  }
  if (depth >= MAX_DEPTH) return REDACTED;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ITEMS).map((item) => maskJobData(item, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) && item !== null ? REDACTED : maskJobData(item, depth + 1),
      ]),
    );
  }
  return REDACTED;
}

/** The reason of a failure without the email addresses and the web addresses it may quote. */
export function maskFailedReason(reason: string | null): string | null {
  if (!reason) return null;
  return reason.replace(EMAIL, REDACTED).replace(ADDRESS, REDACTED).slice(0, MAX_REASON);
}

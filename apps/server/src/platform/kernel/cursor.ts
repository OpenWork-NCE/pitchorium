import { DomainError } from './domain-error';

/** Position of the last item of a page, newest-first lists: its date and a tie-breaker key. */
export interface KeysetPosition {
  at: Date;
  key: string;
}

/**
 * Opaque pagination cursor: base64url of a flat JSON object of strings. Clients must not build
 * or read it; an altered cursor answers 400.
 */
export function encodeCursor(fields: Readonly<Record<string, string>>): string {
  return Buffer.from(JSON.stringify(fields)).toString('base64url');
}

export function decodeCursor(cursor: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalidCursor();
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    !Object.values(parsed).every((value) => typeof value === 'string')
  ) {
    throw invalidCursor();
  }
  return parsed as Record<string, string>;
}

export function encodeKeyset(position: KeysetPosition, extra: Record<string, string> = {}): string {
  return encodeCursor({ ...extra, at: position.at.toISOString(), key: position.key });
}

/** Null without cursor (first page). */
export function decodeKeyset(cursor: string | undefined): KeysetPosition | null {
  if (cursor === undefined) return null;
  return keysetFrom(decodeCursor(cursor));
}

/** Reads the keyset fields of a decoded cursor. */
export function keysetFrom(fields: Readonly<Record<string, string>>): KeysetPosition {
  const at = new Date(fields['at'] ?? '');
  const key = fields['key'];
  if (Number.isNaN(at.getTime()) || !key) throw invalidCursor();
  return { at, key };
}

function invalidCursor(): DomainError {
  return new DomainError('BAD_REQUEST', 'Invalid pagination cursor');
}

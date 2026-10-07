import { describe, expect, it } from 'vitest';
import { decodeCursor, decodeKeyset, encodeCursor, encodeKeyset, keysetFrom } from './cursor';
import { DomainError } from './domain-error';

describe('pagination cursors', () => {
  it('round-trips a keyset position with extra fields', () => {
    const at = new Date('2026-10-07T12:00:00.000Z');
    const cursor = encodeKeyset({ at, key: 'id-1' }, { phase: 'network' });
    expect(decodeKeyset(cursor)).toEqual({ at, key: 'id-1' });
    expect(decodeCursor(cursor)).toEqual({ phase: 'network', at: at.toISOString(), key: 'id-1' });
    expect(decodeKeyset(undefined)).toBeNull();
    expect(decodeCursor(encodeCursor({ a: 'b' }))).toEqual({ a: 'b' });
  });

  it.each([
    ['not base64 json', '%%%'],
    ['an array', Buffer.from('[1]').toString('base64url')],
    ['a non-string value', Buffer.from('{"at":1}').toString('base64url')],
    ['null', Buffer.from('null').toString('base64url')],
  ])('rejects %s', (_label, cursor) => {
    expect(() => decodeCursor(cursor)).toThrow(DomainError);
  });

  it('rejects a cursor without a valid date or key', () => {
    expect(() => keysetFrom({ at: 'yesterday', key: 'k' })).toThrow(DomainError);
    expect(() => keysetFrom({ key: 'k' })).toThrow(DomainError);
    expect(() => keysetFrom({ at: '2026-10-07T12:00:00.000Z' })).toThrow(
      'Invalid pagination cursor',
    );
  });
});

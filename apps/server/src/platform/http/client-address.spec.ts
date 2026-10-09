import { describe, expect, it } from 'vitest';
import {
  CLIENT_ADDRESS_MAX_AGE_MS,
  signClientAddress,
  verifiedClientAddress,
} from './client-address';

const SECRET = 'a-secret-shared-with-the-web-server';
const NOW = 1_780_000_000_000;

describe('relayed visitor address (ADR 0115)', () => {
  it('accepts a recent address signed with the shared secret', () => {
    expect(verifiedClientAddress(signClientAddress('203.0.113.7', SECRET, NOW), SECRET, NOW)).toBe(
      '203.0.113.7',
    );
    expect(
      verifiedClientAddress(signClientAddress('2001:db8::1', SECRET, NOW), SECRET, NOW + 1_000),
    ).toBe('2001:db8::1');
  });

  it('refuses a forged, altered, expired or future header', () => {
    const header = signClientAddress('203.0.113.7', SECRET, NOW);
    expect(
      verifiedClientAddress(
        signClientAddress('203.0.113.7', 'another-secret-of-32-chars-at-least', NOW),
        SECRET,
        NOW,
      ),
    ).toBeNull();
    expect(
      verifiedClientAddress(header.replace('203.0.113.7', '203.0.113.8'), SECRET, NOW),
    ).toBeNull();
    expect(verifiedClientAddress(header, SECRET, NOW + CLIENT_ADDRESS_MAX_AGE_MS + 1)).toBeNull();
    expect(verifiedClientAddress(header, SECRET, NOW - 10_000)).toBeNull();
  });

  it('refuses a malformed header', () => {
    for (const value of [
      undefined,
      '',
      'a;b',
      'not-an-ip;1;x',
      ['1.2.3.4;1;x'],
      `1.2.3.4;${NOW};`,
    ]) {
      expect(verifiedClientAddress(value, SECRET, NOW)).toBeNull();
    }
  });
});

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signClientAddress, visitorAddress } from './client-address';

describe('visitor address relayed to the api (ADR 0115)', () => {
  it('reads the address seen by the outermost trusted proxy', () => {
    expect(visitorAddress('203.0.113.7', 1)).toBe('203.0.113.7');
    // A client writes its own header: the trusted proxy appends what it saw.
    expect(visitorAddress('6.6.6.6, 203.0.113.7', 1)).toBe('203.0.113.7');
    expect(visitorAddress('6.6.6.6, 203.0.113.7, 10.0.0.2', 2)).toBe('203.0.113.7');
    expect(visitorAddress('2001:db8::1', 1)).toBe('2001:db8::1');
  });

  it('relays nothing without a trusted proxy, a header or a valid address', () => {
    expect(visitorAddress('203.0.113.7', 0)).toBeNull();
    expect(visitorAddress(null, 1)).toBeNull();
    expect(visitorAddress('203.0.113.7', 2)).toBeNull();
    expect(visitorAddress('unknown', 1)).toBeNull();
  });

  it('signs the address and the time as the api verifies them', () => {
    const header = signClientAddress('203.0.113.7', 'secret-of-at-least-thirty-two-chars', 1000);
    const expected = createHmac('sha256', 'secret-of-at-least-thirty-two-chars')
      .update('203.0.113.7;1000')
      .digest('base64url');
    expect(header).toBe(`203.0.113.7;1000;${expected}`);
  });
});

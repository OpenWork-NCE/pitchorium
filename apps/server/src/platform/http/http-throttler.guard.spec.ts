import { createHmac } from 'node:crypto';
import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';
import type { ApiConfig } from '../config';
import { signClientAddress } from './client-address';
import { HttpThrottlerGuard } from './http-throttler.guard';

const SECRET = 'a-secret-of-the-tests-long-enough';
const RELAY_SECRET = 'a-secret-shared-with-the-web-server';
const guard = new HttpThrottlerGuard(
  { throttlers: [{ ttl: 60_000, limit: 120 }] },
  {} as ThrottlerStorage,
  new Reflector(),
  { auth: { secret: SECRET }, http: { clientAddressSecret: RELAY_SECRET } } as ApiConfig,
);
const tracker = (request: Record<string, unknown>) =>
  (guard as unknown as { getTracker(r: Record<string, unknown>): Promise<string> }).getTracker(
    request,
  );
const cookie = (token: string, secret = SECRET) =>
  `pitchorium.session_token=${encodeURIComponent(`${token}.${createHmac('sha256', secret).update(token).digest('base64')}`)}`;

describe('rate limiting key (ADR 0114)', () => {
  it('counts a signed session apart from its address, never by the token itself', async () => {
    const key = await tracker({ ip: '10.0.0.1', headers: { cookie: cookie('token-1') } });
    expect(key).toMatch(/^session:[0-9a-f]{64}$/);
    expect(key).not.toContain('token-1');
    expect(await tracker({ ip: '10.0.0.1', headers: { cookie: cookie('token-2') } })).not.toBe(key);
  });

  it('counts by address without a session or with a forged one', async () => {
    expect(await tracker({ ip: '10.0.0.1', headers: {} })).toBe('10.0.0.1');
    expect(await tracker({ ip: '10.0.0.1', headers: { cookie: cookie('x', 'forged') } })).toBe(
      '10.0.0.1',
    );
  });

  it('counts a visitor by the address the web server relays, when it is signed (ADR 0115)', async () => {
    const relayed = signClientAddress('203.0.113.7', RELAY_SECRET, Date.now());
    expect(
      await tracker({ ip: '10.0.0.1', headers: { 'x-pitchorium-client-address': relayed } }),
    ).toBe('203.0.113.7');
    const forged = signClientAddress('203.0.113.7', 'not-the-shared-secret-at-all', Date.now());
    expect(
      await tracker({ ip: '10.0.0.1', headers: { 'x-pitchorium-client-address': forged } }),
    ).toBe('10.0.0.1');
  });
});

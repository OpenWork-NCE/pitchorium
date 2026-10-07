import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkPwnedPassword } from './pwned-passwords';

const PASSWORD = 'correct horse battery staple';
const SUFFIX = createHash('sha1').update(PASSWORD).digest('hex').toUpperCase().slice(5);

const answering =
  (status: number, body: string): typeof fetch =>
  () =>
    Promise.resolve(new Response(body, { status }));

/** A service that never answers: only the abort signal ends the request. */
const hanging: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason as Error));
  });

describe('checkPwnedPassword', () => {
  it('finds a compromised password in the padded range answer', async () => {
    const body = `0000000000000000000000000000000000A:0\r\n${SUFFIX}:42\r\n`;
    await expect(checkPwnedPassword(PASSWORD, { fetch: answering(200, body) })).resolves.toEqual({
      status: 'compromised',
    });
  });

  it('ignores padding entries with a zero count', async () => {
    const body = `${SUFFIX}:0\r\n`;
    await expect(checkPwnedPassword(PASSWORD, { fetch: answering(200, body) })).resolves.toEqual({
      status: 'clean',
    });
  });

  it('reports an error answer as unavailable instead of throwing', async () => {
    await expect(
      checkPwnedPassword(PASSWORD, { fetch: answering(503, 'busy') }),
    ).resolves.toMatchObject({ status: 'unavailable', reason: 'http_error', detail: 'HTTP 503' });
  });

  it('reports an unreachable service as unavailable', async () => {
    const unreachable: typeof fetch = () => Promise.reject(new TypeError('fetch failed'));
    await expect(checkPwnedPassword(PASSWORD, { fetch: unreachable })).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'unreachable',
    });
  });

  it('gives up on a slow service after the timeout', async () => {
    const started = Date.now();
    await expect(
      checkPwnedPassword(PASSWORD, { fetch: hanging, timeoutMs: 50 }),
    ).resolves.toMatchObject({ status: 'unavailable', reason: 'timeout' });
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

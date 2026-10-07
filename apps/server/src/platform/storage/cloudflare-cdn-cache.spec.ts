import { describe, expect, it, vi } from 'vitest';
import { CloudflareCdnCache } from './cloudflare-cdn-cache';

const config = { zoneId: 'a'.repeat(32), apiToken: 'token' };
const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('CloudflareCdnCache', () => {
  it('purges by URL in batches of 100, with the zone token', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(answer(200, { success: true })));
    const urls = Array.from({ length: 150 }, (_, index) => `https://media.example/k${index}`);
    await new CloudflareCdnCache(config, fetchFn).purge([...urls, urls[0] ?? '']);

    expect(fetchFn).toHaveBeenCalledTimes(2);
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/purge_cache`);
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['authorization']).toBe('Bearer token');
    const sizes = fetchFn.mock.calls.map(
      ([, request]) => (JSON.parse(request?.body as string) as { files: string[] }).files.length,
    );
    expect(sizes).toEqual([100, 50]);
  });

  it('throws on a refusal, so that the job is retried', async () => {
    const fetchFn = vi.fn<typeof fetch>(() =>
      Promise.resolve(answer(403, { success: false, errors: [{ code: 10000, message: 'Auth' }] })),
    );
    await expect(new CloudflareCdnCache(config, fetchFn).purge(['https://m/x'])).rejects.toThrow(
      'Cloudflare cache purge failed (HTTP 403: 10000 Auth)',
    );
  });
});

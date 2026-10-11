import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const answer = (locales: string[]) =>
  new Response(JSON.stringify({ defaultLocale: 'fr', locales }), {
    headers: { 'content-type': 'application/json' },
  });

/**
 * Each test reads a fresh module (its cache is per process). The module is imported before the
 * clock is faked, and only `Date` is faked: an import while `setTimeout` is faked waits on the
 * timers of the module runner, which never fire. Alone, the import came from the cache in time;
 * beside the stories (`vitest run` of every project), it waited for its transform and the test ran
 * out of time (FRONT 7, A3).
 */
const fakeClock = () => vi.useFakeTimers({ toFake: ['Date'] });

describe('active locales', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reads them from the api once per minute', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(answer(['fr', 'en'])));
    vi.stubGlobal('fetch', fetchMock);
    const { getActiveLocales } = await import('./active-locales');
    fakeClock();
    expect((await getActiveLocales()).locales).toEqual(['fr', 'en']);
    await getActiveLocales();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api.test/v1/locales');
    vi.advanceTimersByTime(61_000);
    await getActiveLocales();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('offers the source locale only when the api has never answered', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed')));
    const { getActiveLocales } = await import('./active-locales');
    expect(await getActiveLocales()).toEqual({ defaultLocale: 'fr', locales: ['fr'] });
  });

  it('keeps the last answer while the api is unreachable', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(answer(['fr', 'en']))
      .mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);
    const { getActiveLocales } = await import('./active-locales');
    fakeClock();
    await getActiveLocales();
    vi.advanceTimersByTime(61_000);
    expect((await getActiveLocales()).locales).toEqual(['fr', 'en']);
  });

  it('never trusts an unknown locale from the answer', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(answer(['fr', 'xx'])));
    const { getActiveLocales } = await import('./active-locales');
    expect((await getActiveLocales()).locales).toEqual(['fr']);
  });
});

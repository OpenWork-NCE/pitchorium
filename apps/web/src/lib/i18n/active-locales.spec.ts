import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const answer = (locales: string[]) =>
  new Response(JSON.stringify({ defaultLocale: 'fr', locales }), {
    headers: { 'content-type': 'application/json' },
  });

describe('active locales', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reads them from the api once per minute', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(answer(['fr', 'en'])));
    vi.stubGlobal('fetch', fetchMock);
    const { getActiveLocales } = await import('./active-locales');
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
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(answer(['fr', 'en']))
      .mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);
    const { getActiveLocales } = await import('./active-locales');
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

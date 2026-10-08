import {
  ApiProblemError,
  accountControllerActiveLocales,
  configureApiClient,
  postsControllerCreate,
} from '@pitchorium/api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserHeaders } from './browser';

vi.mock('next/headers', () => ({
  headers: () =>
    Promise.resolve(
      new Headers({
        cookie: 'pitchorium.session_token=abc; NEXT_LOCALE=fr',
        'accept-language': 'fr-FR,fr;q=0.9',
        'user-agent': 'test',
      }),
    ),
}));

/** fetch answering a fresh response to every call. */
function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  return vi.fn<typeof fetch>().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...headers },
      }),
    ),
  );
}

describe('browser headers', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { documentElement: { lang: 'en' } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adds the language, and an Idempotency-Key to each POST only', () => {
    const post = browserHeaders({ method: 'POST', url: '/v1/posts', headers: new Headers() });
    expect(post['Accept-Language']).toBe('en');
    expect(post['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    const get = browserHeaders({ method: 'GET', url: '/v1/me', headers: new Headers() });
    expect(get['Idempotency-Key']).toBeUndefined();
  });

  it('keeps the key the caller gives for its intention', () => {
    const headers = new Headers({ 'Idempotency-Key': 'intention-1' });
    expect(
      browserHeaders({ method: 'POST', url: '/v1/posts', headers })['Idempotency-Key'],
    ).toBeUndefined();
  });

  it('sends a new key with each POST through the generated client', async () => {
    const fetchMock = respond(201, { id: 'post' });
    vi.stubGlobal('fetch', fetchMock);
    configureApiClient({ baseUrl: 'http://api.test', headers: browserHeaders });
    await postsControllerCreate({ text: 'a', visibility: 'members' } as never);
    await postsControllerCreate({ text: 'a', visibility: 'members' } as never);
    const keys = fetchMock.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get('Idempotency-Key'),
    );
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).not.toBe(keys[0]);
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe('include');
  });
});

describe('errors', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('turns an RFC 9457 document into a typed error with its code and request id', async () => {
    vi.stubGlobal(
      'fetch',
      respond(
        403,
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          code: 'ACCESS_PREREQUISITES_MISSING',
        },
        { 'x-request-id': 'req-1' },
      ),
    );
    configureApiClient({ baseUrl: 'http://api.test' });
    const error = await accountControllerActiveLocales().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiProblemError);
    expect((error as ApiProblemError).problem.code).toBe('ACCESS_PREREQUISITES_MISSING');
    expect((error as ApiProblemError).requestId).toBe('req-1');
  });

  it('falls back to a generic code when the body is not a problem document', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('Bad gateway', { status: 502 })),
    );
    configureApiClient({ baseUrl: 'http://api.test' });
    const error = (await accountControllerActiveLocales().catch(
      (caught: unknown) => caught,
    )) as ApiProblemError;
    expect(error.problem).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });
});

describe('server calls', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('forward the session cookie and the language of the incoming request, nothing else', async () => {
    const { configureServerApi } = await import('./server');
    const fetchMock = respond(200, { defaultLocale: 'fr', locales: ['fr'] });
    vi.stubGlobal('fetch', fetchMock);
    configureServerApi();
    await accountControllerActiveLocales();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(url).toBe('http://api.test/v1/locales');
    expect(headers.get('cookie')).toBe('pitchorium.session_token=abc; NEXT_LOCALE=fr');
    expect(headers.get('accept-language')).toBe('fr-FR,fr;q=0.9');
    expect(headers.get('user-agent')).toBeNull();
  });
});

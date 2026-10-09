import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { proxy } from './proxy';

vi.mock('@/lib/i18n/active-locales', () => ({
  getActiveLocales: () => Promise.resolve({ defaultLocale: 'fr', locales: ['fr', 'en'] }),
}));

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, 'http://localhost:3200'), { headers });
}

describe('proxy', () => {
  it('redirects an inactive locale to the same page in the default locale', async () => {
    const response = await proxy(request('/sw/projects?page=2'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3200/fr/projects?page=2');
  });

  it('detects an active locale from the browser at the first visit', async () => {
    const response = await proxy(request('/', { 'accept-language': 'en-GB,en;q=0.9' }));
    expect(response.headers.get('location')).toBe('http://localhost:3200/en');
  });

  it('never detects an inactive locale', async () => {
    const response = await proxy(request('/', { 'accept-language': 'sw,en;q=0.5' }));
    expect(response.headers.get('location')).toBe('http://localhost:3200/en');
  });

  it('sends a visitor without session cookie from the member space to the sign-in page', async () => {
    const response = await proxy(request('/en/feed?tab=all'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3200/en/sign-in?redirectTo=%2Fen%2Ffeed%3Ftab%3Dall',
    );
  });

  it('lets a request with a session cookie through, the api checks it', async () => {
    const response = await proxy(request('/en/feed', { cookie: 'pitchorium.session_token=abc' }));
    expect(response.headers.get('location')).toBeNull();
  });

  it('sets a CSP with a fresh nonce, forwarded to the render', async () => {
    const first = await proxy(request('/fr'));
    const second = await proxy(request('/fr'));
    const nonce = /'nonce-([^']+)'/.exec(first.headers.get('content-security-policy') ?? '')?.[1];
    expect(nonce).toBeTruthy();
    expect(second.headers.get('content-security-policy')).not.toContain(nonce);
    expect(first.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
  });
});

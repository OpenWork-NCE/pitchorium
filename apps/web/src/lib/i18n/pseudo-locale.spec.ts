import { afterEach, describe, expect, it, vi } from 'vitest';
import { isLocalOrigin, pseudoLocalization } from './pseudo-locale';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('pseudoLocalization', () => {
  it('is off by default', () => {
    vi.stubEnv('WEB_PSEUDO_LOCALIZATION', '');
    expect(pseudoLocalization()).toBe(false);
  });

  it('is on for a site served from this machine', () => {
    vi.stubEnv('WEB_PSEUDO_LOCALIZATION', 'true');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3201');
    expect(pseudoLocalization()).toBe(true);
  });

  it('is never on for a site served to anyone else', () => {
    vi.stubEnv('WEB_PSEUDO_LOCALIZATION', 'true');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://pitchorium.example');
    expect(pseudoLocalization()).toBe(false);
    expect(isLocalOrigin('https://localhost.pitchorium.example')).toBe(false);
    expect(isLocalOrigin('not a url')).toBe(false);
  });
});

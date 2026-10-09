import { describe, expect, it } from 'vitest';
import { safeRedirect, withRedirect } from './redirect';

describe('safeRedirect', () => {
  it('keeps a path of the web app, with its query and fragment', () => {
    expect(safeRedirect('/fr/projects?view=followed#top', '/fr/feed')).toBe(
      '/fr/projects?view=followed#top',
    );
    expect(safeRedirect('/en/settings/security', '/en/feed')).toBe('/en/settings/security');
  });

  it.each([
    null,
    undefined,
    '',
    'https://evil.example/fr/feed',
    'javascript:alert(1)',
    '//evil.example',
    '///evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    '/\tevil',
    'fr/feed',
    `/${'a'.repeat(2048)}`,
  ])('refuses %j and returns the fallback', (value) => {
    expect(safeRedirect(value, '/fr/feed')).toBe('/fr/feed');
  });

  it('normalises dot segments without leaving the origin', () => {
    expect(safeRedirect('/fr/../../evil', '/fr/feed')).toBe('/evil');
  });
});

describe('withRedirect', () => {
  it('appends the return address, encoded', () => {
    expect(withRedirect('/fr/sign-in', '/fr/projects?view=followed')).toBe(
      '/fr/sign-in?redirectTo=%2Ffr%2Fprojects%3Fview%3Dfollowed',
    );
    expect(withRedirect('/fr/check-email?kind=magic', '/fr/feed')).toBe(
      '/fr/check-email?kind=magic&redirectTo=%2Ffr%2Ffeed',
    );
    expect(withRedirect('/fr/sign-in', null)).toBe('/fr/sign-in');
  });
});

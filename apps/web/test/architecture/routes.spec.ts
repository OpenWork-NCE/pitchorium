import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { routes } from '@/config/routes';

const root = join(import.meta.dirname, '../..');
const pages = join(root, 'src/app/[locale]');

const escape = (segment: string) => segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The pages of the app under its locale, as patterns: route groups left out, a dynamic segment
 * matching one segment. The catch-all of unknown addresses (`[...rest]`) is no page: a link that
 * only reaches it leads nowhere.
 */
function pagePatterns(): RegExp[] {
  return readdirSync(pages, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name === 'page.tsx')
    .map((entry) =>
      relative(pages, entry.parentPath)
        .split(sep)
        .filter((segment) => segment && !/^\(.+\)$/.test(segment)),
    )
    .filter((segments) => !segments.some((segment) => segment.startsWith('[...')))
    .map(
      (segments) =>
        new RegExp(
          `^/${segments.map((segment) => (segment.startsWith('[') ? '[^/]+' : escape(segment))).join('/')}$`,
        ),
    );
}

const PATTERNS = pagePatterns();

/** Path of an internal link, without its query, its fragment and a trailing slash. */
const pathOf = (href: string) => href.split(/[?#]/)[0]!.replace(/(.)\/$/, '$1');

const leadsToAPage = (href: string) => PATTERNS.some((pattern) => pattern.test(pathOf(href)));

/** Every address of `routes`, a resource address with a sample key for each of its parts. */
const ROUTES = Object.entries(routes).map(([name, value]) => ({
  name,
  href: typeof value === 'function' ? value('sample-key', 'sample-key') : value,
}));

/** Source files of the app, stories and tests left out. */
function sources(): string[] {
  return readdirSync(join(root, 'src'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .filter((entry) => !/\.(spec|stories)\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

describe('internal links (A6)', () => {
  it('finds the pages of the app', () => {
    expect(PATTERNS.length).toBeGreaterThan(20);
    expect(leadsToAPage('/members/aissatou-ba')).toBe(true);
    expect(leadsToAPage('/settings/moderation')).toBe(false);
  });

  it('gives every address of routes a page of the app', () => {
    expect(ROUTES.filter(({ href }) => !leadsToAPage(href))).toEqual([]);
  });

  it('never writes a literal internal link to a page that does not exist', () => {
    // A literal address in an href or a redirect (`href="/x"`, `` `/${locale}/x` ``); an address
    // built from `routes` is checked above.
    const literal = /(?:href|redirect\()\s*[=:({]*\s*[`'"](\/[^`'"]*)[`'"]/g;
    const offenders = sources().flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(literal)]
        .map((match) => match[1]!.replace(/^\/\$\{locale\}/, ''))
        .filter((href) => href !== '' && !href.includes('${') && !leadsToAPage(href))
        .map((href) => `${relative(root, path)}: ${href}`),
    );
    expect(offenders).toEqual([]);
  });
});

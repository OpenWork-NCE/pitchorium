import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { buildCsp, sentryTarget, SONNER_STYLE_HASHES } from './csp';

const base = {
  nonce: 'abc',
  development: false,
  apiUrl: 'https://api.pitchorium.example',
  cdnUrl: 'https://cdn.pitchorium.example/public',
  vercelAnalytics: false,
  https: true,
};

const directive = (csp: string, name: string) =>
  csp.split('; ').find((entry) => entry.startsWith(`${name} `) || entry === name);

describe('content security policy', () => {
  it('runs scripts with the nonce only, without eval in production', () => {
    const csp = buildCsp(base);
    expect(directive(csp, 'script-src')).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(directive(csp, 'object-src')).toBe("object-src 'none'");
    expect(directive(csp, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(csp, 'upgrade-insecure-requests')).toBeDefined();
  });

  it('lists the exact origins of the api, the files and the embedded videos', () => {
    const csp = buildCsp(base);
    expect(directive(csp, 'connect-src')).toBe(
      "connect-src 'self' https://api.pitchorium.example wss://api.pitchorium.example",
    );
    expect(directive(csp, 'img-src')).toContain('https://cdn.pitchorium.example');
    expect(directive(csp, 'frame-src')).toBe(
      'frame-src https://www.youtube-nocookie.com https://player.vimeo.com',
    );
  });

  it('adds Sentry and Vercel only when they are configured', () => {
    const csp = buildCsp({
      ...base,
      sentryDsn: 'https://key@o1.ingest.sentry.io/42',
      vercelAnalytics: true,
    });
    expect(directive(csp, 'connect-src')).toContain('https://o1.ingest.sentry.io');
    expect(directive(csp, 'connect-src')).toContain('https://vitals.vercel-insights.com');
    expect(directive(csp, 'report-uri')).toBe(
      `report-uri ${sentryTarget('https://key@o1.ingest.sentry.io/42').report}`,
    );
    expect(sentryTarget('https://key@o1.ingest.sentry.io/42').report).toBe(
      'https://o1.ingest.sentry.io/api/42/security/?sentry_key=key',
    );
  });

  it('allows eval and inline styles in development only', () => {
    const csp = buildCsp({ ...base, development: true, https: false });
    expect(directive(csp, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(csp, 'style-src')).toBe("style-src 'self' 'unsafe-inline'");
    expect(directive(csp, 'upgrade-insecure-requests')).toBeUndefined();
  });

  it('allows the stylesheet sonner inserts, hashed from the installed version', () => {
    const source = readFileSync(createRequire(import.meta.url).resolve('sonner'), 'utf8');
    const literal = /__insertCSS\("((?:[^"\\]|\\.)*)"\)/.exec(source)?.[1];
    const stylesheet = JSON.parse(`"${literal}"`) as string;
    const hash = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
    expect(SONNER_STYLE_HASHES).toEqual([hash(''), hash(stylesheet)]);
  });
});

/**
 * Content Security Policy of every page (ADR 0088), built per request by the proxy with a fresh
 * nonce. Scripts run only with the nonce (`strict-dynamic` lets them load their chunks); the
 * origins below are the exact list the app needs.
 */
export interface CspOptions {
  nonce: string;
  /** Development server: React needs eval, HMR injects styles without the nonce. */
  development: boolean;
  apiUrl: string;
  cdnUrl?: string | undefined;
  sentryDsn?: string | undefined;
  vercelAnalytics: boolean;
  /** Only an HTTPS site upgrades its subresource requests. */
  https: boolean;
}

/**
 * sonner inserts its stylesheet at runtime, without a nonce: an empty `<style>` first, then its
 * text. Both hashes are allowed; a unit test recomputes them from the installed version.
 */
export const SONNER_STYLE_HASHES = [
  "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
  "'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY='",
];

/** Embedded videos, in their privacy-respecting variants (ADR 0042). */
const VIDEO_FRAMES = ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'];

/** Hosted checkouts the contribution flow posts to or redirects to (ADR 0043). */
const PAYMENT_FORMS = ['https://checkout.stripe.com', 'https://checkout.flutterwave.com'];

const VERCEL_SCRIPTS = 'https://va.vercel-scripts.com';
const VERCEL_VITALS = 'https://vitals.vercel-insights.com';

function origin(url: string): string {
  return new URL(url).origin;
}

/** Same host over WebSocket, for Socket.IO. */
function socketOrigin(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol === 'https:' ? 'wss:' : 'ws:'}//${parsed.host}`;
}

interface SentryTarget {
  ingest: string;
  report: string;
}

/** Ingest origin and CSP report endpoint derived from the DSN. */
export function sentryTarget(dsn: string): SentryTarget {
  const parsed = new URL(dsn);
  const projectId = parsed.pathname.replace(/^\//, '');
  return {
    ingest: parsed.origin,
    report: `${parsed.origin}/api/${projectId}/security/?sentry_key=${parsed.username}`,
  };
}

export function buildCsp(options: CspOptions): string {
  const nonce = `'nonce-${options.nonce}'`;
  const api = origin(options.apiUrl);
  const cdn = options.cdnUrl ? [origin(options.cdnUrl)] : [];
  const sentry = options.sentryDsn ? sentryTarget(options.sentryDsn) : undefined;
  const vercel = options.vercelAnalytics;

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      nonce,
      "'strict-dynamic'",
      ...(options.development ? ["'unsafe-eval'"] : []),
      ...(vercel ? [VERCEL_SCRIPTS] : []),
    ],
    // A nonce disables 'unsafe-inline': the development server keeps it for its HMR styles.
    'style-src': options.development
      ? ["'self'", "'unsafe-inline'"]
      : ["'self'", nonce, ...SONNER_STYLE_HASHES],
    // Inline style attributes (React, Radix, next/image) cannot carry a nonce.
    'style-src-attr': ["'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', api, ...cdn],
    'font-src': ["'self'"],
    'connect-src': [
      "'self'",
      api,
      socketOrigin(options.apiUrl),
      ...(sentry ? [sentry.ingest] : []),
      ...(vercel ? [VERCEL_VITALS] : []),
    ],
    'media-src': ["'self'", ...cdn],
    'frame-src': VIDEO_FRAMES,
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'", ...PAYMENT_FORMS],
    'frame-ancestors': ["'none'"],
    ...(options.https ? { 'upgrade-insecure-requests': [] } : {}),
    ...(sentry ? { 'report-uri': [sentry.report] } : {}),
  };

  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(' '))
    .join('; ');
}

/** Random nonce of 128 bits, base64-encoded. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

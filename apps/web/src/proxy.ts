import type { Locale } from '@pitchorium/contracts';
import createMiddleware from 'next-intl/middleware';
import { defineRouting } from 'next-intl/routing';
import { NextRequest, NextResponse } from 'next/server';
import { requiresSession, routes, SESSION_COOKIES } from '@/config/routes';
import { routing } from '@/i18n/routing';
import { env } from '@/lib/env';
import { getActiveLocales } from '@/lib/i18n/active-locales';
import { buildCsp, createNonce } from '@/lib/security/csp';
import { REDIRECT_PARAM } from '@/lib/auth/redirect';

/** One next-intl handler per set of active locales: detection only picks an active locale. */
const handlers = new Map<string, ReturnType<typeof createMiddleware>>();

function i18nHandler(locales: readonly Locale[]): ReturnType<typeof createMiddleware> {
  const key = locales.join(',');
  let handler = handlers.get(key);
  if (!handler) {
    handler = createMiddleware(defineRouting({ ...routing, locales: [...locales] }));
    handlers.set(key, handler);
  }
  return handler;
}

function splitLocale(pathname: string): { locale: Locale | undefined; rest: string } {
  const [, first = '', ...others] = pathname.split('/');
  const locale = routing.locales.find((candidate) => candidate === first);
  return locale ? { locale, rest: `/${others.join('/')}` } : { locale: undefined, rest: pathname };
}

function withSecurity(response: NextResponse, csp: string): NextResponse {
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

/**
 * Runs before every page (Next.js 16 proxy, Node.js runtime): nonce and CSP, locale limited to
 * the active ones, and a light check that a session cookie exists in the member space. The api
 * checks the session itself on every call.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    development: process.env.NODE_ENV === 'development',
    apiUrl: env.NEXT_PUBLIC_API_URL,
    cdnUrl: env.NEXT_PUBLIC_CDN_URL,
    uploadUrl: env.NEXT_PUBLIC_UPLOAD_URL,
    sentryDsn: env.NEXT_PUBLIC_SENTRY_DSN,
    vercelAnalytics: env.NEXT_PUBLIC_VERCEL_ANALYTICS,
    https: env.NEXT_PUBLIC_SITE_URL.startsWith('https://'),
  });

  const { defaultLocale, locales } = await getActiveLocales();
  const { pathname, search } = request.nextUrl;
  const { locale, rest } = splitLocale(pathname);

  // A known but inactive locale is never served: same page in the default locale.
  if (locale && !locales.includes(locale)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${rest === '/' ? '' : rest}`;
    return withSecurity(NextResponse.redirect(url), csp);
  }

  if (
    locale &&
    requiresSession(rest) &&
    !SESSION_COOKIES.some((name) => request.cookies.has(name))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${routes.signIn}`;
    url.search = `?${REDIRECT_PARAM}=${encodeURIComponent(`${pathname}${search}`)}`;
    return withSecurity(NextResponse.redirect(url), csp);
  }

  // Next.js reads the nonce from the CSP header of the request; next-intl forwards its headers.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const forwarded = new NextRequest(request, { headers });
  return withSecurity(i18nHandler(locales)(forwarded), csp);
}

export const config = {
  matcher: [
    {
      // Pages only: no route handler, static asset, file with an extension or prefetch.
      source: '/((?!api|_next|_vercel|.*\\..*).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

/**
 * Public configuration for the browser code, inlined by Next.js at build time. It is validated
 * by env.ts, which next.config.ts loads: the browser bundle needs no validation library.
 */
export const publicEnv = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  sentryEnvironment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || 'development',
  legalTermsUrl: process.env.NEXT_PUBLIC_LEGAL_TERMS_URL || undefined,
  legalPrivacyUrl: process.env.NEXT_PUBLIC_LEGAL_PRIVACY_URL || undefined,
} as const;

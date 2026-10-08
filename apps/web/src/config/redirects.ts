import type { NextConfig } from 'next';

type Redirect = Awaited<ReturnType<NonNullable<NextConfig['redirects']>>>[number];

/**
 * Permanent redirects of former URLs, read by next.config.ts. Typed so that a malformed entry
 * fails the type check; empty until a public URL changes.
 */
export const redirects: Redirect[] = [];

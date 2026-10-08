'use client';

import type { Locale } from '@pitchorium/contracts';
import { createContext, type ReactNode, use } from 'react';

const ActiveLocalesContext = createContext<readonly Locale[]>([]);

/** Locales enabled by their feature flag, read by the server from `GET /v1/locales`. */
export function ActiveLocalesProvider({
  locales,
  children,
}: {
  locales: readonly Locale[];
  children: ReactNode;
}) {
  return <ActiveLocalesContext value={locales}>{children}</ActiveLocalesContext>;
}

export function useActiveLocales(): readonly Locale[] {
  return use(ActiveLocalesContext);
}

'use client';

import {
  contributionsControllerOptions,
  getContributionsControllerOptionsQueryKey,
} from '@pitchorium/api-client';
import type { PaymentOptions } from '@pitchorium/contracts';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/** Wait after the last change of the country, the currency or the amount before reading again. */
export const OPTIONS_DEBOUNCE_MS = 500;

export interface OptionsRequest {
  country?: string | undefined;
  currency?: string | undefined;
  /** Requires `currency` (the api refuses an amount without its currency). */
  amountMinor?: string | undefined;
}

/** A value that follows another after it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * The payment options of a project for this contributor (`GET .../payment-options`, ADR 0135):
 * read again, after a short wait, when the country, the currency or the amount change; the
 * previous answer stays shown meanwhile. Never computed here.
 */
export function usePaymentOptions(projectId: string, request: OptionsRequest = {}) {
  const country = useDebounced(request.country, OPTIONS_DEBOUNCE_MS);
  const currency = useDebounced(request.currency, OPTIONS_DEBOUNCE_MS);
  const amountMinor = useDebounced(request.amountMinor, OPTIONS_DEBOUNCE_MS);
  const params = {
    ...(country ? { country } : {}),
    ...(currency ? { currency } : {}),
    ...(currency && amountMinor ? { amountMinor } : {}),
  };
  return useQuery({
    queryKey: getContributionsControllerOptionsQueryKey(projectId, params),
    queryFn: ({ signal }) =>
      contributionsControllerOptions(projectId, params, { signal }) as Promise<PaymentOptions>,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

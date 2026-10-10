'use client';

import { contributionsControllerQuote } from '@pitchorium/api-client';
import type { ContributionKind, ContributionQuote, PaymentMethod } from '@pitchorium/contracts';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { OPTIONS_DEBOUNCE_MS, useDebounced } from './use-payment-options';

export interface QuoteInput {
  kind: ContributionKind | null;
  currency: string | null;
  amountMinor: string | null;
  rewardId?: string | null;
  method?: PaymentMethod | null;
  country?: string | null;
}

/**
 * The quote of the api for these choices (`POST .../contribution-quotes`, §9.3 step 7): amount,
 * EUR equivalent, commission, estimated fees, estimated amount for the holder, rate and reward
 * eligibility. Read after a short wait when a choice changes; the interface computes none of it.
 */
export function useQuote(projectId: string, input: QuoteInput, enabled = true) {
  const settled = useDebounced(input, OPTIONS_DEBOUNCE_MS);
  const ready = Boolean(settled.kind && settled.currency && settled.amountMinor);
  return useQuery({
    queryKey: ['payments', 'quote', projectId, settled],
    queryFn: ({ signal }) =>
      contributionsControllerQuote(
        projectId,
        {
          kind: settled.kind!,
          amount: { amountMinor: settled.amountMinor!, currency: settled.currency! },
          ...(settled.rewardId ? { rewardId: settled.rewardId } : {}),
          ...(settled.method ? { method: settled.method } : {}),
          ...(settled.country ? { country: settled.country } : {}),
        },
        { signal },
      ) as Promise<ContributionQuote>,
    enabled: enabled && ready,
    placeholderData: keepPreviousData,
    // A quote holds a rate of the moment: read again rather than kept.
    staleTime: 0,
    gcTime: 60_000,
    retry: false,
  });
}

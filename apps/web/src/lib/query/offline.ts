'use client';

import {
  type MutateOptions,
  onlineManager,
  useMutation,
  type UseMutationOptions,
  useMutationState,
} from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** Online state of the browser, as TanStack Query sees it (it pauses queries and mutations). */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/** Mutations waiting for the network: paused offline, replayed at the reconnection. */
export function usePausedMutations(): number {
  return useMutationState({ filters: { predicate: (mutation) => mutation.state.isPaused } }).length;
}

interface Intent<Input> {
  input: Input;
  /** Idempotency-Key of the intention, kept when the mutation is replayed (ADR 0097). */
  key: string;
}

type IdempotentOptions<Output, Input> = Omit<
  UseMutationOptions<Output, unknown, Intent<Input>>,
  'mutationFn'
> & {
  /** The call of the api, with the headers to send (the generated client's request options). */
  mutationFn: (input: Input, request: { headers: Record<string, string> }) => Promise<Output>;
};

/**
 * A write of the api that survives an offline period (ADR 0097): its Idempotency-Key is drawn
 * once, when the person acts, and travels with the paused mutation; TanStack Query replays it
 * at the reconnection with the same key, so that the api never applies it twice. `mutate`
 * takes the input only.
 */
export function useIdempotentMutation<Output, Input = void>({
  mutationFn,
  ...options
}: IdempotentOptions<Output, Input>) {
  const mutation = useMutation<Output, unknown, Intent<Input>>({
    ...options,
    mutationFn: ({ input, key }) => mutationFn(input, { headers: { 'Idempotency-Key': key } }),
  });
  return {
    ...mutation,
    mutate: (input: Input, options?: MutateOptions<Output, unknown, Intent<Input>>) =>
      mutation.mutate({ input, key: crypto.randomUUID() }, options),
  };
}

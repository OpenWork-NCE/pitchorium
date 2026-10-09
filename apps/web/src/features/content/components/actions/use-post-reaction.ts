'use client';

import type { ReactionSummary, ReactionType } from '@pitchorium/contracts';
import { MutationObserver, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  type Intent,
  PERSISTED_MUTATIONS,
  type ReactionInput,
} from '@/lib/query/persisted-mutations';

const { mutationKey, mutationFn } = PERSISTED_MUTATIONS.reaction;

/**
 * The reaction to a publication as a persisted mutation (ADR 0102): sent with the Idempotency-Key
 * of the gesture, in the order of the gestures on this publication; made offline, it waits for
 * the network and survives the closing of the tab. Built at the gesture: a feed of dozens of
 * publications hydrates no observer.
 */
export function usePostReaction(postId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    (next: ReactionType | null) =>
      new MutationObserver<ReactionSummary, unknown, Intent<ReactionInput>>(queryClient, {
        mutationKey,
        mutationFn: mutationFn,
        scope: { id: `reaction:${postId}` },
      }).mutate({ input: { postId, type: next }, key: crypto.randomUUID() }),
    [queryClient, postId],
  );
}

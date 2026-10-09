'use client';

import {
  ApiProblemError,
  getMemberNetworkControllerRelationshipQueryKey,
  getNotificationsControllerCountersQueryKey,
  useMemberNetworkControllerRelationship,
} from '@pitchorium/api-client';
import type { Relationship } from '@pitchorium/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { afterAction, type RelationshipAction } from '../lib/relationship';

/** Every query of the network feature starts with this key: lists, requests, suggestions. */
export const NETWORK_QUERY_ROOT = ['network'] as const;

/** Message of a refusal of the api, from its stable code (`errors.<code>`). */
export function useProblemMessage(): (error: unknown) => string {
  const errors = useTranslations('errors');
  return useCallback(
    (error: unknown) => {
      const code = error instanceof ApiProblemError ? error.problem.code : 'INTERNAL_ERROR';
      return errors.has(code as never) ? errors(code as never) : errors('INTERNAL_ERROR');
    },
    [errors],
  );
}

interface Change {
  action: RelationshipAction;
  /** The call of the api; its answer may complete the relationship (the id of a request). */
  call: () => Promise<unknown>;
}

/**
 * The relationship of the reader with a member, from the server's first render, and its changes:
 * each one shows at once (ADR 0112), the call goes to the api, a refusal gives the previous state
 * back. Once settled, the relationship, the counters and the lists of the network are read again.
 */
export function useRelationship(handle: string, initial: Relationship) {
  const queryClient = useQueryClient();
  const key = getMemberNetworkControllerRelationshipQueryKey(handle);
  const query = useMemberNetworkControllerRelationship(handle, {
    query: { initialData: initial, staleTime: 60_000 },
  });
  const change = useMutation({
    mutationFn: ({ call }: Change) => call(),
    onMutate: async ({ action }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Relationship>(key);
      if (previous) queryClient.setQueryData(key, afterAction(previous, action));
      return { previous };
    },
    onSuccess: (answer, { action }) => {
      // A sent request is answered with its id, needed to withdraw it.
      const requestId = (answer as { id?: string } | undefined)?.id;
      if (action.kind === 'request' && requestId) {
        queryClient.setQueryData<Relationship>(key, (current) =>
          current ? afterAction(current, { kind: 'request', requestId }) : current,
        );
      }
    },
    onError: (_error, _change, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: getNotificationsControllerCountersQueryKey() }),
        queryClient.invalidateQueries({ queryKey: NETWORK_QUERY_ROOT }),
      ]),
  });
  return {
    relationship: query.data ?? initial,
    pending: change.isPending ? change.variables.action.kind : null,
    /** Runs a change; resolves once the api answered, rejects with its refusal. */
    run: (action: RelationshipAction, call: () => Promise<unknown>) =>
      change.mutateAsync({ action, call }),
  };
}

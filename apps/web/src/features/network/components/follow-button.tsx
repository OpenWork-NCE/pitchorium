'use client';

import {
  followsControllerFollow,
  followsControllerUnfollow,
  getFollowsControllerStateQueryKey,
  useFollowsControllerState,
} from '@pitchorium/api-client';
import type { FollowState } from '@pitchorium/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { IconSwap, LabelSwap } from '@/components/motion';
import { Button, Count, notify, useAnnounce } from '@/components/ui';
import { usePlural } from '@/lib/i18n/plural';
import { NETWORK_QUERY_ROOT, useProblemMessage } from './use-relationship';

/**
 * « Suivre » an organisation or a project (§10.2), from the state the server read: the button and
 * the count of followers change at once (ADR 0112) and come back if the api refuses.
 */
export function FollowButton({
  type,
  targetKey,
  name,
  initial,
}: {
  type: 'organization' | 'project';
  /** The key of the target for the network: its id (ADR 0027). */
  targetKey: string;
  name: string;
  initial: FollowState;
}) {
  const t = useTranslations('web.network.follow');
  const announce = useAnnounce();
  const message = useProblemMessage();
  const plural = usePlural();
  const queryClient = useQueryClient();
  const key = getFollowsControllerStateQueryKey(type, targetKey);
  const query = useFollowsControllerState(type, targetKey, {
    query: { initialData: initial, staleTime: 60_000 },
  });
  const state = query.data ?? initial;
  const toggle = useMutation({
    mutationFn: async (follow: boolean) => {
      if (follow) await followsControllerFollow(type, targetKey);
      else await followsControllerUnfollow(type, targetKey);
    },
    onMutate: async (follow) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FollowState>(key);
      queryClient.setQueryData<FollowState>(key, (current) =>
        current
          ? {
              following: follow,
              followers: current.followers === null ? null : current.followers + (follow ? 1 : -1),
            }
          : current,
      );
      return { previous };
    },
    onSuccess: (_answer, follow) => announce(t(follow ? 'followed' : 'unfollowed', { name })),
    onError: (error, _follow, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      notify.error(message(error));
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: NETWORK_QUERY_ROOT }),
      ]),
  });
  const step = state.following ? 'following' : 'follow';
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant={state.following ? 'outline' : 'primary'}
        aria-pressed={state.following}
        aria-label={t(state.following ? 'unfollowName' : 'followName', { name })}
        onClick={() => toggle.mutate(!state.following)}
      >
        <IconSwap
          state={step}
          icons={{ follow: <Bell aria-hidden />, following: <BellRing aria-hidden /> }}
        />
        <LabelSwap state={step} labels={{ follow: t('follow'), following: t('following') }} />
      </Button>
      {state.followers === null ? null : (
        <span className="text-sm text-muted">
          <Count value={state.followers} className="font-medium text-foreground" />{' '}
          {t(`followers.${plural(state.followers)}`)}
        </span>
      )}
    </div>
  );
}

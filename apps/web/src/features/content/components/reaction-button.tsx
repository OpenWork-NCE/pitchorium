'use client';

import { getPostsControllerReadQueryKey } from '@pitchorium/api-client';
import type { Post } from '@pitchorium/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ThumbsUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui';
import {
  type Intent,
  PERSISTED_MUTATIONS,
  type ReactionInput,
} from '@/lib/query/persisted-mutations';

const { mutationKey, mutationFn } = PERSISTED_MUTATIONS.reaction;

/**
 * « J'aime » under a publication: pressed at once, sent with the Idempotency-Key of the gesture.
 * Made offline, it waits for the network, kept on the device even if the tab closes (ADR 0102);
 * the reactions of one publication go in their order.
 */
export function ReactionButton({ post }: { post: Post }) {
  const t = useTranslations('reference.reactionTypes');
  const queryClient = useQueryClient();
  const [reaction, setReaction] = useState(post.reactions.viewerReaction);
  const react = useMutation<unknown, unknown, Intent<ReactionInput>>({
    mutationKey,
    mutationFn,
    scope: { id: `reaction:${post.id}` },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getPostsControllerReadQueryKey() }),
  });
  const liked = reaction === 'like';
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={liked}
      className={liked ? 'text-link' : undefined}
      onClick={() => {
        const next = liked ? null : 'like';
        setReaction(next);
        react.mutate({ input: { postId: post.id, type: next }, key: crypto.randomUUID() });
      }}
    >
      <ThumbsUp aria-hidden />
      {t('like')}
    </Button>
  );
}

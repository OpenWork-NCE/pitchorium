'use client';

import { getPostsControllerReadQueryKey } from '@pitchorium/api-client';
import type { Post } from '@pitchorium/contracts';
import { MutationObserver, useQueryClient } from '@tanstack/react-query';
import { ThumbsUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { useWithPrerequisites } from '@/features/access';
import {
  type Intent,
  PERSISTED_MUTATIONS,
  type ReactionInput,
} from '@/lib/query/persisted-mutations';

const { mutationKey, mutationFn } = PERSISTED_MUTATIONS.reaction;

/**
 * « J'aime » under a publication: pressed at once, sent with the Idempotency-Key of the gesture.
 * Made offline, it waits for the network, kept on the device even if the tab closes (ADR 0102);
 * the reactions of one publication go in their order. Refused for a missing prerequisite, the form
 * of the element opens and the reaction is sent again (§7.2, step 4).
 */
export function ReactionButton({ post }: { post: Post }) {
  const t = useTranslations('reference.reactionTypes');
  const queryClient = useQueryClient();
  const [reaction, setReaction] = useState(post.reactions.viewerReaction);
  const withPrerequisites = useWithPrerequisites();
  // The mutation is built at the gesture: a feed of dozens of buttons hydrates no observer.
  const react = (variables: Intent<ReactionInput>) =>
    new MutationObserver<unknown, unknown, Intent<ReactionInput>>(queryClient, {
      mutationKey,
      mutationFn,
      scope: { id: `reaction:${post.id}` },
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getPostsControllerReadQueryKey() }),
    }).mutate(variables);
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
        // Refused for a missing element (terms), its form opens, then the reaction is sent
        // again with a new key; refused for good, the button goes back to its state.
        withPrerequisites(() =>
          react({ input: { postId: post.id, type: next }, key: crypto.randomUUID() }),
        ).catch(() => setReaction(liked ? 'like' : null));
      }}
    >
      <ThumbsUp aria-hidden />
      {t('like')}
    </Button>
  );
}

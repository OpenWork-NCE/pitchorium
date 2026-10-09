'use client';

import { getPostsControllerReadQueryKey } from '@pitchorium/api-client';
import type { FeedPage, Post } from '@pitchorium/contracts';
import { type InfiniteData, useQueryClient } from '@tanstack/react-query';
import { PenLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { lazy, Suspense, useState } from 'react';
import { Avatar, Card } from '@/components/ui';
import { useCurrentMember } from '@/features/identity';
import { usePathname, useRouter } from '@/i18n/navigation';
import { FEED_PAGE_SIZE } from '../lib/feed-items';

/**
 * The editor, its extensions and the image tray load when the composer is about to open (hover,
 * focus) or opens, never with the feed (ADR 0094).
 */
const loadComposer = () => import('./composer/composer-dialog');
const ComposerDialog = lazy(loadComposer);

/** The new publication at the top of the feed of the tab. */
function prepend(queryClient: ReturnType<typeof useQueryClient>, post: Post) {
  queryClient.setQueryData<InfiniteData<FeedPage>>(
    [...getPostsControllerReadQueryKey({ limit: FEED_PAGE_SIZE }), 'stream'],
    (data) =>
      data && data.pages[0]
        ? {
            ...data,
            pages: [
              {
                ...data.pages[0],
                items: [{ type: 'post', id: `post:${post.id}`, post }, ...data.pages[0].items],
              },
              ...data.pages.slice(1),
            ],
          }
        : data,
  );
}

/**
 * « Commencer une publication » at the top of the feed: opens the composer (its code loads on
 * the hover or the focus of the button, or at the press), also when the « Publier » of the
 * header leads here (`?compose=1`). The publication published goes at the top of the feed.
 */
export function FeedComposer() {
  const t = useTranslations('web.feed');
  const member = useCurrentMember();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [chosen, setChosen] = useState(false);
  // « Publier » of the header leads to `/feed?compose=1`: the composer opens; closed, the
  // address loses its parameter.
  const requested = params.get('compose') === '1';
  const open = chosen || requested;
  const setOpen = (next: boolean) => {
    setChosen(next);
    if (!next && requested) router.replace(pathname, { scroll: false });
  };

  return (
    <>
      <Card padding="sm" className="flex items-center gap-3">
        <Avatar name={member.profile.displayName} src={member.profile.avatarUrl} decorative />
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          onPointerEnter={() => void loadComposer()}
          onFocus={() => void loadComposer()}
          className="flex h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm text-muted outline-none hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus"
        >
          <span className="truncate">{t('compose')}</span>
          <PenLine aria-hidden className="size-4 shrink-0" />
        </button>
      </Card>
      {open ? (
        <Suspense fallback={null}>
          <ComposerDialog
            open={open}
            onOpenChange={setOpen}
            onPublished={(post) => prepend(queryClient, post)}
          />
        </Suspense>
      ) : null}
    </>
  );
}

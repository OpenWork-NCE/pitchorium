'use client';

import { getPostsControllerReadQueryKey, postsControllerRead } from '@pitchorium/api-client';
import type { FeedPage, Post, Suggestion } from '@pitchorium/contracts';
import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Newspaper } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { Button, EmptyState, ErrorState, Pagination, useAnnounce } from '@/components/ui';
import { useMotionPreference } from '@/components/motion';
import { useWithPrerequisites } from '@/features/access';
import { MemberHoverCard } from '@/features/profiles';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { interleave } from '@/lib/collections/interleave';
import { reportError } from '@/lib/observability/report-error';
import {
  type DrawnItem,
  drawnItems,
  FEED_MODULES,
  FEED_PAGE_SIZE,
  newItems,
} from '../../lib/feed-items';
import { type FeedPosition, saveFeedPosition, takeFeedPosition } from '../../lib/feed-position';
import { PostFooter } from '../actions/post-footer';
import { PostMenu } from '../actions/post-menu';
import { PostCard } from '../post-card';
import { PostSkeleton } from '../post-skeleton';
import { FeedSuggestion, SuggestionModule } from './feed-suggestion';
import { NewerPill } from './newer-pill';
import { ProjectUpdateCard } from './project-update-card';
import { useViewObserver } from './use-view-observer';

/** First height of an item before it is measured (a publication with a short text). */
const ESTIMATED_HEIGHT = 420;
/** Items kept rendered above and below the screen. */
const OVERSCAN = 4;
/** Entries rendered by the server and hydrated before the list is virtualized. */
const FIRST_ENTRIES = 6;
const HEADER_OFFSET = 88;

type Entry = { kind: 'item'; value: DrawnItem } | { kind: 'module'; value: Suggestion[] };
type Measurements = FeedPosition['measurements'];

const feedKey = () => [...getPostsControllerReadQueryKey({ limit: FEED_PAGE_SIZE }), 'stream'];

const keyOf = (entries: readonly Entry[], index: number) => {
  const entry = entries[index];
  return entry?.kind === 'item' ? entry.value.id : `module-${index}`;
};

/** Unknown types are reported once per page view (Sentry when configured). */
const reported = new Set<string>();
function reportUnknown(type: string) {
  if (reported.has(type)) return;
  reported.add(type);
  reportError(new Error(`Unknown type of feed item: ${type}`));
}

/** The real heights of the entries in the page, for the virtualized list that takes over. */
function measure(list: HTMLElement, scrollMargin: number): Measurements {
  let start = scrollMargin;
  return [...list.querySelectorAll<HTMLElement>(':scope > [data-index]')].map((element) => {
    const size = element.getBoundingClientRect().height;
    const measured = {
      index: Number(element.dataset.index),
      key: element.dataset.feedKey ?? '',
      start,
      size,
      end: start + size,
      lane: 0,
    };
    start += size;
    return measured;
  });
}

/**
 * The feed (§10.3, ADR 0032, ADR 0121): a WAI-ARIA `feed` (articles with their position, Page
 * Down and Page Up between them, Ctrl End and Ctrl Home out of it), read page by page as the
 * reader nears its end. Its first entries are rendered by the server and hydrated as they are;
 * then the list is virtualized (only the entries near the screen are rendered, in the flow of the
 * page, between two spaces of their measured height), from the real heights of those first
 * entries, so that a reader who scrolls before the page is hydrated sees nothing jump; it is
 * given back where it was after a return by the history. Publications, reposts, highlights,
 * project updates and suggestions; an unknown type is left out and reported. New publications
 * wait behind a pill (ADR 0117); those seen are signalled (ADR 0116). A hidden or deleted
 * publication leaves by a transform.
 */
export function FeedList({
  initialPage,
  modules,
}: {
  /** First page, read by the server; null if the api could not answer (read here). */
  initialPage: FeedPage | null;
  /** Suggestions of people, three by three, among the items of a narrow screen. */
  modules: readonly Suggestion[][];
}) {
  const t = useTranslations('web.feed');
  const queryClient = useQueryClient();
  const withPrerequisites = useWithPrerequisites();
  const announce = useAnnounce();
  const reduced = useMotionPreference() === 'reduced';
  const watch = useViewObserver();
  const listRef = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  // Once hydrated: the measurements the virtualized list starts from (or the position kept).
  const [virtual, setVirtual] = useState<{ measurements: Measurements; offset: number } | null>(
    null,
  );

  const feed = useInfiniteQuery({
    queryKey: feedKey(),
    queryFn: ({ pageParam, signal }) =>
      postsControllerRead(
        { limit: FEED_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) },
        { signal },
      ) as Promise<FeedPage>,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    ...(initialPage ? { initialData: { pages: [initialPage], pageParams: [undefined] } } : {}),
    staleTime: 60_000,
  });
  const pages = useMemo(() => feed.data?.pages ?? [], [feed.data]);
  const head = pages[0]?.head ?? null;
  const items = useMemo(
    () =>
      drawnItems(
        pages.flatMap((page) => page.items),
        reportUnknown,
      ),
    [pages],
  );
  const entries: Entry[] = useMemo(
    () => interleave(items, modules, FEED_MODULES),
    [items, modules],
  );

  // Hydrated: the virtualized list takes over, from the real heights (or the position kept).
  useEffect(() => {
    const list = listRef.current;
    if (!list || virtual) return;
    const restored = takeFeedPosition();
    const frame = requestAnimationFrame(() => {
      const margin = list.getBoundingClientRect().top + window.scrollY;
      setVirtual(
        restored
          ? { measurements: restored.measurements, offset: restored.offset }
          : { measurements: measure(list, margin), offset: window.scrollY },
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [virtual, entries.length]);

  // A publication leaving: the ones below slide up by a transform, never by its height.
  const positions = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const next = new Map<string, number>();
    for (const element of list.querySelectorAll<HTMLElement>('[data-feed-key]')) {
      const key = element.dataset.feedKey!;
      const top = element.offsetTop;
      const before = positions.current.get(key);
      if (!reduced && before !== undefined && before !== top) {
        element.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }], {
          duration: 320,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        });
      }
      next.set(key, top);
    }
    positions.current = next;
  });

  function setPages(change: (pages: FeedPage[]) => FeedPage[]) {
    queryClient.setQueryData<InfiniteData<FeedPage>>(feedKey(), (data) =>
      data ? { ...data, pages: change(data.pages) } : data,
    );
  }

  function replacePost(post: Post) {
    setPages((all) =>
      all.map((page) => ({
        ...page,
        items: page.items.map((item) =>
          (item.type === 'post' || item.type === 'repost' || item.type === 'featured') &&
          item.post.id === post.id
            ? { ...item, post }
            : item,
        ),
      })),
    );
  }

  /** Takes an item out (hidden, deleted), after its leaving transition; null puts it back. */
  const removed = useRef(
    new Map<string, { page: number; position: number; item: FeedPage['items'][number] }>(),
  );
  function remove(itemId: string, reason: 'hidden' | 'deleted' | null) {
    if (reason === null) {
      const kept = removed.current.get(itemId);
      if (!kept) return;
      removed.current.delete(itemId);
      setPages((all) =>
        all.map((page, index) =>
          index === kept.page
            ? {
                ...page,
                items: [
                  ...page.items.slice(0, kept.position),
                  kept.item,
                  ...page.items.slice(kept.position),
                ],
              }
            : page,
        ),
      );
      return;
    }
    setLeaving((current) => new Set(current).add(itemId));
    window.setTimeout(
      () => {
        setPages((all) =>
          all.map((page, index) => {
            const position = page.items.findIndex((item) => item.id === itemId);
            if (position === -1) return page;
            removed.current.set(itemId, { page: index, position, item: page.items[position]! });
            return { ...page, items: page.items.filter((item) => item.id !== itemId) };
          }),
        );
        setLeaving((current) => {
          const next = new Set(current);
          next.delete(itemId);
          return next;
        });
      },
      reduced ? 0 : 320,
    );
  }

  /** The new publications above the first one shown, then the scroll and the focus to them. */
  async function showNewer() {
    const page = await postsControllerRead({ limit: FEED_PAGE_SIZE });
    const known = pages[0]?.items ?? [];
    const fresh = newItems(page.items, known);
    flushSync(() =>
      setPages((all) =>
        all.length
          ? [{ ...all[0]!, items: [...fresh, ...all[0]!.items], head: page.head }, ...all.slice(1)]
          : [page],
      ),
    );
    const top =
      (listRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - HEADER_OFFSET;
    window.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
    listRef.current?.querySelector<HTMLElement>('[data-feed-index="0"]')?.focus({
      preventScroll: true,
    });
    announce(t('newPosts.other', { count: fresh.length }));
  }

  if (!initialPage && feed.isPending) {
    return (
      <div className="grid gap-4">
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  }
  if (feed.isError && !feed.data) {
    const retry = () =>
      withPrerequisites(async () => {
        const result = await feed.refetch();
        if (result.error) throw result.error;
      }).catch(() => undefined);
    return <ErrorState title={t('error')} onRetry={() => void retry()} />;
  }
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Newspaper />}
        title={t('emptyTitle')}
        description={t('emptyBody')}
        action={
          <Button asChild variant="secondary">
            <Link href={routes.network}>{t('emptyAction')}</Link>
          </Button>
        }
      />
    );
  }

  const setSize = feed.hasNextPage ? -1 : entries.length;
  const renderEntry = (index: number, measureRef?: (element: Element | null) => void) => {
    const entry = entries[index]!;
    const key = keyOf(entries, index);
    const position = {
      'data-feed-index': index,
      tabIndex: 0,
      'aria-posinset': index + 1,
      'aria-setsize': setSize,
    } as const;
    if (entry.kind === 'module') {
      return (
        <div
          key={key}
          ref={measureRef}
          data-index={index}
          data-feed-key={key}
          className="pb-4 lg:hidden"
        >
          <SuggestionModule suggestions={entry.value} {...position} />
        </div>
      );
    }
    const item = entry.value;
    let content: ReactNode;
    if (item.type === 'project_update') {
      content = (
        <article
          aria-label={t('projectUpdate', { project: item.update.project.title })}
          className="rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-focus"
          {...position}
        >
          <ProjectUpdateCard update={item.update} />
        </article>
      );
    } else if (item.type === 'suggestion') {
      content = <FeedSuggestion suggestion={item.suggestion} {...position} />;
    } else {
      content = (
        <PostCard
          {...position}
          ref={watch(item.post.viewerIsAuthor ? null : item.post.id)}
          className="rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-focus"
          post={item.post}
          signedIn
          featured={item.type === 'featured'}
          name={
            item.post.author.type === 'member' ? (
              <MemberHoverCard
                member={item.post.author.member}
                signedIn
                className="truncate font-semibold text-foreground hover:underline"
              />
            ) : undefined
          }
          menu={
            <PostMenu
              post={item.post}
              onChange={replacePost}
              onRemove={(reason) => remove(item.id, reason)}
            />
          }
          footer={
            <PostFooter
              post={item.post}
              onReposted={(repost) =>
                setPages((all) =>
                  all.length
                    ? [
                        {
                          ...all[0]!,
                          items: [
                            { type: 'repost', id: `repost:${repost.id}`, post: repost },
                            ...all[0]!.items,
                          ],
                        },
                        ...all.slice(1),
                      ]
                    : all,
                )
              }
            />
          }
        />
      );
    }
    return (
      <div
        key={key}
        ref={measureRef}
        data-index={index}
        data-feed-key={key}
        className="post-leave pb-4"
        data-leaving={leaving.has(item.id) ? '' : undefined}
      >
        {content}
      </div>
    );
  };

  return (
    <>
      <NewerPill key={head ?? 'none'} head={head} onShow={showNewer} />
      {virtual ? (
        <VirtualEntries
          listRef={listRef}
          count={entries.length}
          keyAt={(index) => keyOf(entries, index)}
          start={virtual}
          label={t('label')}
          busy={feed.isFetchingNextPage}
          onNearEnd={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          renderEntry={renderEntry}
        />
      ) : (
        <FeedElement listRef={listRef} label={t('label')} busy={false} count={entries.length}>
          {entries.slice(0, FIRST_ENTRIES).map((_, index) => renderEntry(index))}
        </FeedElement>
      )}
      <div className="grid gap-2" data-feed-after tabIndex={-1}>
        {feed.isFetchingNextPage ? <PostSkeleton /> : null}
        <Pagination
          hasMore={feed.hasNextPage}
          loading={feed.isFetchingNextPage}
          onLoadMore={() => void feed.fetchNextPage()}
          shown={items.length}
        />
        {feed.isFetchNextPageError ? (
          <p role="alert" className="text-center text-sm text-danger">
            {t('moreError')}
          </p>
        ) : null}
      </div>
    </>
  );
}

/**
 * The element of the feed (`role="feed"`) and its keys (WAI-ARIA feed pattern): Page Down and
 * Page Up move the focus between the articles (`scrollTo` brings one not rendered yet), Ctrl End
 * and Ctrl Home leave the feed.
 */
function FeedElement({
  listRef,
  label,
  busy,
  count,
  scrollTo,
  style,
  children,
}: {
  listRef: RefObject<HTMLDivElement | null>;
  label: string;
  busy: boolean;
  count: number;
  scrollTo?: (index: number) => void;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const navigate = (event: KeyboardEvent) => {
      const article = (event.target as HTMLElement).closest<HTMLElement>('[data-feed-index]');
      if (!article) return;
      const index = Number(article.dataset.feedIndex);
      if (event.key === 'PageDown' || event.key === 'PageUp') {
        event.preventDefault();
        const step = event.key === 'PageDown' ? 1 : -1;
        // An entry hidden at this width (the suggestions of a phone, on a wide screen) is
        // passed over; one not rendered yet (virtualized) is not hidden.
        const hidden = (at: number) => {
          const element = list.querySelector<HTMLElement>(`[data-feed-index="${at}"]`);
          return element !== null && element.getClientRects().length === 0;
        };
        let target = index + step;
        while (target >= 0 && target < count && hidden(target)) target += step;
        if (target < 0 || target >= count) return;
        scrollTo?.(target);
        // Virtualized, the entry is rendered once the scroll has moved: a few frames at most.
        const focus = (frames: number) =>
          requestAnimationFrame(() => {
            const element = list.querySelector<HTMLElement>(`[data-feed-index="${target}"]`);
            if (element) element.focus();
            else if (frames > 0) focus(frames - 1);
          });
        focus(10);
      } else if (event.ctrlKey && (event.key === 'End' || event.key === 'Home')) {
        event.preventDefault();
        document
          .querySelector<HTMLElement>(
            event.key === 'End' ? '[data-feed-after]' : '[data-feed-before]',
          )
          ?.focus();
      }
    };
    list.addEventListener('keydown', navigate);
    return () => list.removeEventListener('keydown', navigate);
  }, [listRef, count, scrollTo]);
  return (
    <div ref={listRef} role="feed" aria-label={label} aria-busy={busy} style={style}>
      {children}
    </div>
  );
}

/**
 * The virtualized feed, mounted once the first entries are hydrated: it starts from their
 * measured heights (or from the position kept for a return by the history), renders the entries
 * near the screen between two spaces, asks for the next page near the end and keeps its
 * position when it leaves.
 */
function VirtualEntries({
  listRef,
  count,
  keyAt,
  start,
  label,
  busy,
  onNearEnd,
  renderEntry,
}: {
  listRef: RefObject<HTMLDivElement | null>;
  count: number;
  keyAt: (index: number) => string;
  start: { measurements: Measurements; offset: number };
  label: string;
  busy: boolean;
  onNearEnd: () => void;
  renderEntry: (index: number, measureRef: (element: Element | null) => void) => ReactNode;
}) {
  const [scrollMargin] = useState(() => start.measurements[0]?.start ?? 0);
  const virtualizer = useWindowVirtualizer({
    count,
    estimateSize: () => ESTIMATED_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: keyAt,
    scrollMargin,
    initialOffset: start.offset,
    initialMeasurementsCache: start.measurements,
  });

  // Back by the history: the scroll goes where it was, once the heights are known.
  useLayoutEffect(() => {
    if (Math.abs(window.scrollY - start.offset) > 1) window.scrollTo({ top: start.offset });
  }, [start.offset]);

  // Leaving the feed: its position is kept for a return by the history.
  useEffect(
    () => () =>
      saveFeedPosition({
        offset: window.scrollY,
        measurements: virtualizer.measurementsCache.map((item) => ({ ...item })),
      }),
    [virtualizer],
  );

  const items = virtualizer.getVirtualItems();
  const lastIndex = items.at(-1)?.index ?? 0;
  useEffect(() => {
    if (lastIndex >= count - 3) onNearEnd();
  }, [lastIndex, count, onNearEnd]);

  const before = items[0] ? items[0].start - scrollMargin : 0;
  const after = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0);
  return (
    <FeedElement
      listRef={listRef}
      label={label}
      busy={busy}
      count={count}
      scrollTo={(index) => virtualizer.scrollToIndex(index, { align: 'start' })}
      style={{ paddingTop: before, paddingBottom: after }}
    >
      {items.map((item) => renderEntry(item.index, virtualizer.measureElement))}
    </FeedElement>
  );
}

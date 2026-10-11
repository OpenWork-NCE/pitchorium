'use client';

import { ArrowDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button, Spinner } from '@/components/ui';
import { usePlural } from '@/lib/i18n/plural';
import { type Anchor, captureAnchor, isAtEnd, type PlacedRow, restoreAnchor } from '../lib/anchor';
import type { ThreadRow } from '../lib/thread-rows';
import { type ThreadContext, ThreadRowView } from './conversation-thread';

/** From this many rows, only those near the view are in the document (ADR 0146). */
export const VIRTUALIZE_FROM = 150;
/** Older messages are asked when the view comes this close to the top. */
const OLDER_MARGIN_PX = 320;

/** TanStack Virtual loads with the first long history, never with the page. */
const VirtualRows = dynamic(() => import('./virtual-rows'), { ssr: false });

/** Positions of the rows drawn in the document, for a short history. */
function placedInDocument(list: HTMLElement | null): PlacedRow[] {
  if (!list) return [];
  return [...list.querySelectorAll<HTMLElement>('[data-row-key]')].map((element) => ({
    key: element.dataset['rowKey'] ?? '',
    start: element.offsetTop,
    size: element.offsetHeight,
  }));
}

interface ThreadScrollerProps {
  rows: readonly ThreadRow[];
  context: ThreadContext;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  /** The view shows the end of the thread: what arrived is read. */
  onSeeEnd: () => void;
  /** Under the last message: the typing indicator. */
  footer?: ReactNode;
}

/**
 * The scroller of an open conversation (§10.4, ADR 0146): it opens at the last message, asks
 * older ones when the view nears the top and keeps the reading place when they arrive (the
 * first row seen stays where it was), follows a new message when the end is in view, and
 * otherwise offers « Nouveaux messages » without moving. A long history is virtualized.
 */
export function ThreadScroller({
  rows,
  context,
  hasOlder,
  loadingOlder,
  onLoadOlder,
  onSeeEnd,
  footer,
}: ThreadScrollerProps) {
  const t = useTranslations('web.messaging');
  const plural = usePlural();
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const placedRef = useRef<(() => PlacedRow[]) | null>(null);
  const anchor = useRef<Anchor | null>(null);
  const atEnd = useRef(true);
  const previous = useRef<{ last: string | undefined }>({ last: undefined });
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [unseen, setUnseen] = useState(0);
  const virtual = rows.length >= VIRTUALIZE_FROM;

  const placed = () =>
    virtual ? (placedRef.current?.() ?? []) : placedInDocument(listRef.current);

  const remember = () => {
    const element = scrollRef.current;
    if (!element) return;
    anchor.current = captureAnchor(placed(), element.scrollTop);
    atEnd.current = isAtEnd(element.scrollTop, element.clientHeight, element.scrollHeight);
  };

  const toEnd = () => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
    atEnd.current = true;
    setUnseen(0);
  };

  // A change of rows: the first row seen keeps its place (older messages arrive above it), and
  // a new one at the end is followed when the end was in view.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    const before = previous.current;
    if (element && before.last !== undefined) {
      element.scrollTop = restoreAnchor(anchor.current, placed(), element.scrollTop);
      const from = rows.findIndex((row) => row.key === before.last);
      const appended = from === -1 ? [] : rows.slice(from + 1);
      if (appended.length > 0) {
        setFresh(new Set(appended.map((row) => row.key)));
        const latest = rows.at(-1);
        const mine = latest?.kind === 'message' && latest.author === 'me';
        if (atEnd.current || mine) toEnd();
        else setUnseen((count) => count + appended.filter((row) => row.kind === 'message').length);
      }
    } else if (element) {
      toEnd();
    }
    previous.current = { last: rows.at(-1)?.key };
    remember();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  useEffect(() => {
    if (atEnd.current && document.visibilityState === 'visible') onSeeEnd();
  });

  // Content that grows once drawn (a file, a publication, the measure of a row), or a view that
  // shrinks, keeps the end in view when it was.
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = content.current;
    const scroller = scrollRef.current;
    if (!element || !scroller || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (atEnd.current) scroller.scrollTop = scroller.scrollHeight;
    });
    // The content grows, or the view shrinks (the composer replaces its place once loaded).
    observer.observe(element);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto overscroll-contain px-4 pb-2"
        onScroll={() => {
          remember();
          const element = scrollRef.current;
          if (atEnd.current) {
            setUnseen(0);
            onSeeEnd();
          }
          if (element && element.scrollTop < OLDER_MARGIN_PX && hasOlder && !loadingOlder) {
            onLoadOlder();
          }
        }}
        data-thread-scroller=""
      >
        {hasOlder ? (
          <div className="flex justify-center py-3">
            {loadingOlder ? (
              <Spinner label={t('loadingOlder')} />
            ) : (
              <Button variant="ghost" size="sm" onClick={onLoadOlder}>
                {t('older')}
              </Button>
            )}
          </div>
        ) : null}
        <div ref={content}>
          {virtual ? (
            <VirtualRows
              rows={rows}
              context={{ ...context, fresh }}
              scrollRef={scrollRef}
              label={t('history')}
              placedRef={placedRef}
            />
          ) : (
            <ol ref={listRef} aria-label={t('history')} className="grid">
              {rows.map((row) => (
                <li key={row.key} data-row-key={row.key}>
                  <ThreadRowView row={row} context={{ ...context, fresh }} />
                </li>
              ))}
            </ol>
          )}
        </div>
        {footer}
      </div>
      {unseen > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <button
            type="button"
            onClick={toEnd}
            className="pill-in pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-on-accent shadow-md outline-none hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <ArrowDown aria-hidden className="size-4" />
            {t(`newBelow.${plural(unseen)}`, { count: unseen })}
          </button>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { type RefObject, useEffect } from 'react';
import type { PlacedRow } from '../lib/anchor';
import type { ThreadRow } from '../lib/thread-rows';
import { type ThreadContext, ThreadRowView } from './conversation-thread';

/** Estimated height of a row before it is measured: a day heading, a message of two lines. */
const estimate = (row: ThreadRow | undefined) => (row?.kind === 'day' ? 44 : 64);

/**
 * The rows of a long history, virtualized in the scroller of the conversation (ADR 0146):
 * only those near the view are in the document; each row is measured once drawn, and a row
 * above the view that changes height moves the scroll by as much (TanStack Virtual), so the
 * reading place stays. `onPlaced` gives the positions to the anchoring of the history.
 */
export default function VirtualRows({
  rows,
  context,
  scrollRef,
  label,
  placedRef,
}: {
  rows: readonly ThreadRow[];
  context: ThreadContext;
  scrollRef: RefObject<HTMLDivElement | null>;
  label: string;
  placedRef: RefObject<(() => PlacedRow[]) | null>;
}) {
  // TanStack Virtual returns functions that change with the scroll: the compiler leaves this
  // component unmemoized, which it needs.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => estimate(rows[index]),
    getItemKey: (index) => rows[index]?.key ?? index,
    overscan: 8,
  });
  useEffect(() => {
    placedRef.current = () => {
      // The total size measures the rows first: the cache then holds every row of the count.
      virtualizer.getTotalSize();
      return virtualizer.measurementsCache.map((item) => ({
        key: String(item.key),
        start: item.start,
        size: item.size,
      }));
    };
    return () => {
      placedRef.current = null;
    };
  }, [virtualizer, placedRef]);

  return (
    <ol
      aria-label={label}
      className="relative"
      style={{ height: virtualizer.getTotalSize() }}
      data-virtualized=""
    >
      {virtualizer.getVirtualItems().map((item) => {
        const row = rows[item.index];
        if (!row) return null;
        return (
          <li
            key={item.key}
            data-index={item.index}
            data-row-key={row.key}
            ref={virtualizer.measureElement}
            className="absolute inset-x-0 top-0"
            style={{ transform: `translateY(${item.start}px)` }}
          >
            <ThreadRowView row={row} context={context} />
          </li>
        );
      })}
    </ol>
  );
}

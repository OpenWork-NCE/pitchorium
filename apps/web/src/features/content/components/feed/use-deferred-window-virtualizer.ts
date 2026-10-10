'use client';

import type * as VirtualModule from '@tanstack/react-virtual';
import type { Range, Virtualizer, VirtualizerOptions } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useMemo, useReducer, useState } from 'react';
import { flushSync } from 'react-dom';

type Core = typeof VirtualModule;

type Options<T extends Element> = Omit<
  VirtualizerOptions<Window, T>,
  | 'getScrollElement'
  | 'observeElementRect'
  | 'observeElementOffset'
  | 'scrollToFn'
  | 'initialOffset'
  | 'rangeExtractor'
> & {
  /** Stretches the indexes the default extractor gives (the focused entry kept rendered). */
  extendRange?: (indexes: number[], range: Range) => number[];
};

/** A virtualizer whose measures from a ref callback are flagged while they run. */
function createVirtualizer<T extends Element>(
  core: Core,
  options: VirtualizerOptions<Window, T>,
  measuring: { fromRef: boolean },
): Virtualizer<Window, T> {
  const virtualizer = new core.Virtualizer<Window, T>(options);
  const measureElement = virtualizer.measureElement;
  virtualizer.measureElement = (node: T | null) => {
    measuring.fromRef = true;
    try {
      measureElement(node);
    } finally {
      measuring.fromRef = false;
    }
  };
  return virtualizer;
}

/**
 * `useWindowVirtualizer` of `@tanstack/react-virtual` (same options, same rendering and flush
 * rules, without its direct DOM updates), with TanStack Virtual loaded after the
 * hydration rather than in the first load of the feed (ADR 0121: the first entries are rendered
 * by the server and hydrated as they are, the list is virtualized afterwards). Null until it is there.
 */
export function useDeferredWindowVirtualizer<T extends Element>({
  extendRange,
  ...options
}: Options<T>): Virtualizer<Window, T> | null {
  const [core, setCore] = useState<Core | null>(null);
  useEffect(() => {
    let live = true;
    void import('@tanstack/react-virtual').then((loaded) => {
      if (live) setCore(loaded);
    });
    return () => {
      live = false;
    };
  }, []);

  const rerender = useReducer((count: number) => count + 1, 0)[1];
  // A measure asked by a ref callback runs while React commits: flushSync cannot flush there.
  const [measuring] = useState(() => ({ fromRef: false }));

  const resolved = (loaded: Core): VirtualizerOptions<Window, T> => ({
    ...options,
    getScrollElement: () => (typeof document !== 'undefined' ? window : null),
    observeElementRect: loaded.observeWindowRect,
    observeElementOffset: loaded.observeWindowOffset,
    scrollToFn: loaded.windowScroll,
    initialOffset: () => (typeof document !== 'undefined' ? window.scrollY : 0),
    rangeExtractor: (range) => {
      const indexes = loaded.defaultRangeExtractor(range);
      return extendRange ? extendRange(indexes, range) : indexes;
    },
    onChange: (instance, sync) => {
      if (sync && !measuring.fromRef) flushSync(rerender);
      else rerender();
      options.onChange?.(instance, sync);
    },
  });

  const instance = useMemo(
    () => (core ? createVirtualizer(core, resolved(core), measuring) : null),
    // Created once, when it arrives; its options are set again at each render below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [core],
  );

  if (instance && core) instance.setOptions(resolved(core));

  useLayoutEffect(() => instance?._didMount(), [instance]);
  useLayoutEffect(() => instance?._willUpdate());

  return instance;
}

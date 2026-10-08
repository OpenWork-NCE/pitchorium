'use client';

import { type ComponentType, createElement, useEffect, useSyncExternalStore } from 'react';
import { cn } from '@/lib/cn';
import { whenIdle } from '@/lib/preload';
import type { IndicatorProps } from './shared-indicator-motion';
import { useMotionPreference } from './use-motion-preference';

interface SharedIndicatorProps {
  /** Same id for every item of one navigation or tab list: the indicator glides between them. */
  layoutId: string;
  className?: string;
}

// Motion, loaded once for every indicator of the page.
let Loaded: ComponentType<IndicatorProps> | null = null;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();

function load(): Promise<void> {
  loading ??= import('./shared-indicator-motion').then(
    (module) => {
      Loaded = module.default;
      for (const listener of listeners) listener();
    },
    () => {
      loading = undefined;
    },
  );
  return loading;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Indicator of the active item of a navigation or a tab list (Motion `layoutId`): rendered in
 * the active item only, it moves from the previous one. Until Motion is loaded, when the page is
 * idle, and with less motion, it jumps.
 */
export function SharedIndicator({ layoutId, className }: SharedIndicatorProps) {
  const reduced = useMotionPreference() === 'reduced';
  const Indicator = useSyncExternalStore(
    subscribe,
    () => Loaded,
    () => null,
  );
  useEffect(() => whenIdle(() => void load()), []);
  const classes = cn('pointer-events-none absolute', className);
  // The loaded module is a stable component, created once for the page.
  return Indicator ? (
    createElement(Indicator, { layoutId, className: classes, reduced })
  ) : (
    <span aria-hidden className={classes} />
  );
}

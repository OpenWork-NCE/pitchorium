'use client';

import { type ReactNode, useEffect, useRef, ViewTransition } from 'react';

/** The first render of the session is the landing page: it never animates. */
let navigated = false;

/**
 * Page transition of level 1 (fade and rise, 200 to 400 ms). React's `<ViewTransition>` drives
 * the View Transitions API on every navigation (styles `page-enter` and `page-exit` in
 * globals.css); browsers without it get the same rise through a CSS animation
 * (`[data-page-enter]`), without any animation library. Mounted by the templates of the groups,
 * which remount on each navigation. With less motion, nothing moves.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!navigated) {
      navigated = true;
      return;
    }
    if ('startViewTransition' in document) return;
    ref.current?.setAttribute('data-page-enter', '');
  }, []);

  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      <div ref={ref}>{children}</div>
    </ViewTransition>
  );
}

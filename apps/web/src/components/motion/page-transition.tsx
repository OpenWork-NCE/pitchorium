'use client';

import { useAnimate } from 'motion/react-mini';
import { type ReactNode, useEffect, ViewTransition } from 'react';
import { EASE, seconds } from './tokens';
import { useMotionPreference } from './use-motion-preference';

/** The first render of the session is the landing page: it never animates. */
let navigated = false;

/**
 * Page transition of level 1 (fade and rise, 200 to 400 ms). React's `<ViewTransition>` drives
 * the View Transitions API on every navigation (styles `page-enter` and `page-exit` in
 * globals.css); browsers without it get the same rise through Motion. Mounted by the template
 * of the locale, which remounts on each navigation.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduced = useMotionPreference() === 'reduced';

  useEffect(() => {
    if (!navigated) {
      navigated = true;
      return;
    }
    if (reduced || 'startViewTransition' in document || !scope.current) return;
    void animate(
      scope.current,
      { opacity: [0, 1], transform: ['translateY(12px)', 'translateY(0px)'] },
      { duration: seconds('page'), ease: [...EASE.enter] },
    );
    // Runs once per mount: the template mounts a new instance for each page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      <div ref={scope}>{children}</div>
    </ViewTransition>
  );
}

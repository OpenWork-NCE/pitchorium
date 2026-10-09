'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** How long the new content may replace its loading state and still receive the focus. */
const SETTLE_MS = 5000;

function focusMain(): HTMLElement | null {
  const main = document.getElementById('main');
  main?.focus({ preventScroll: true });
  return main;
}

/**
 * After a navigation inside the app, the focus goes to the start of the new content (`#main`),
 * as a full page load would do, instead of staying on a link of the header. When the loading
 * state is then replaced by the page, its `#main` with it, the focus follows to the new one, as
 * long as it has fallen back to the body and the member has not acted meanwhile. Next.js
 * announces the title of the new page itself (route announcer).
 */
export function RouteFocus() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let focused = focusMain();
    const observer = new MutationObserver(() => {
      const main = document.getElementById('main');
      const lost = document.activeElement === null || document.activeElement === document.body;
      if (main && main !== focused && lost) focused = focusMain();
    });
    const stop = () => {
      observer.disconnect();
      window.removeEventListener('keydown', stop, true);
      window.removeEventListener('pointerdown', stop, true);
    };
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('keydown', stop, true);
    window.addEventListener('pointerdown', stop, true);
    const timer = setTimeout(stop, SETTLE_MS);
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [pathname]);
  return null;
}

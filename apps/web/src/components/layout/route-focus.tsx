'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * After a navigation inside the app, the focus goes to the start of the new content (`#main`),
 * as a full page load would do, instead of staying on a link of the header. Next.js announces
 * the title of the new page itself (route announcer).
 */
export function RouteFocus() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}

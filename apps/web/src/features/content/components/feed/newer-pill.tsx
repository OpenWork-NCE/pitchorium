'use client';

import { postsControllerNewer } from '@pitchorium/api-client';
import { ArrowUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { usePlural } from '@/lib/i18n/plural';

/** How often the feed asks whether its network published (ADR 0117). */
export const NEWER_INTERVAL_MS = 60_000;

/** Less data asked: the check waits for a gesture (Save-Data, prefers-reduced-data). */
function savesData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return (
    connection?.saveData === true || window.matchMedia('(prefers-reduced-data: reduce)').matches
  );
}

/**
 * « N nouvelles publications » (ADR 0117): the count of the publications of the network newer
 * than the head of the feed, asked every minute while the tab is visible and data is not saved,
 * and once on coming back to the tab; it slides from the top and nothing moves until it is
 * pressed. The press shows them (`onShow`), then the pill leaves. A new head (the feed shown
 * again) starts a new pill (`key`).
 */
export function NewerPill({ head, onShow }: { head: string | null; onShow: () => Promise<void> }) {
  const t = useTranslations('web.feed.newPosts');
  const plural = usePlural();
  const [newer, setNewer] = useState<{ count: number; capped: boolean } | null>(null);
  const [showing, setShowing] = useState(false);
  const last = useRef(0);

  useEffect(() => {
    if (!head) return undefined;
    last.current = Date.now();
    let cancelled = false;
    const check = () => {
      if (document.visibilityState !== 'visible' || savesData()) return;
      last.current = Date.now();
      postsControllerNewer({ head }).then(
        (answer) => !cancelled && setNewer(answer.count > 0 ? answer : null),
        () => undefined,
      );
    };
    const timer = setInterval(check, NEWER_INTERVAL_MS);
    const back = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - last.current >= NEWER_INTERVAL_MS
      ) {
        check();
      }
    };
    document.addEventListener('visibilitychange', back);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', back);
    };
  }, [head]);

  const label = newer
    ? newer.capped
      ? t('capped', { count: newer.count })
      : t(plural(newer.count), { count: newer.count })
    : '';
  return (
    <div
      aria-live="polite"
      className="pointer-events-none sticky top-[calc(var(--header-height)+0.75rem)] z-(--z-sticky) flex h-0 justify-center"
    >
      {newer ? (
        <button
          type="button"
          disabled={showing}
          onClick={() => {
            setShowing(true);
            void onShow().finally(() => {
              setShowing(false);
              setNewer(null);
            });
          }}
          className="pill-in pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-medium text-on-accent shadow-md outline-none hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <ArrowUp aria-hidden className="size-4" />
          {label}
        </button>
      ) : null}
    </div>
  );
}

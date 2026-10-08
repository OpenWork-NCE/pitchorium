'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface TruncateProps {
  children: ReactNode;
  /** Lines shown while collapsed. */
  lines?: 2 | 3 | 4 | 6;
  className?: string;
}

const CLAMPS = {
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  6: 'line-clamp-6',
} as const;

/**
 * Long text cut after a few lines, with "voir plus" (`aria-expanded`) only when it is actually
 * cut. The whole text stays in the page for search engines and screen readers.
 */
export function Truncate({ children, lines = 3, className }: TruncateProps) {
  const t = useTranslations('web.ui.truncate');
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || expanded) return;
    const measure = () => setClamped(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, children]);

  return (
    <div className={cn('grid justify-items-start gap-1', className)}>
      <div id={id} ref={ref} className={cn(!expanded && CLAMPS[lines])}>
        {children}
      </div>
      {clamped || expanded ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(!expanded)}
          className="cursor-pointer rounded-xs link-underline-hover text-sm font-medium text-link"
        >
          {expanded ? t('less') : t('more')}
        </button>
      ) : null}
    </div>
  );
}

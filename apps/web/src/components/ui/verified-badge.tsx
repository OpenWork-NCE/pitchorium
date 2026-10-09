'use client';

import { BadgeCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/** The positioned tooltip loads at the first hover or focus (ADR 0094), as for IconButton. */
const TooltipLayer = lazy(() => import('./lazy-tooltip'));

const DELAY_MS = 400;

interface VerifiedBadgeProps {
  /** What was verified and by whom ("Organisation vérifiée par Pitchorium"). */
  description?: string;
  /** `icon` next to a name; `label` with the word. */
  display?: 'icon' | 'label';
  className?: string;
}

/**
 * Verification granted by Pitchorium (organisations, §13), never a self-declaration. Named by its
 * description, shown again as a tooltip on hover and on keyboard focus, dismissed by Escape
 * (WCAG 1.4.13).
 */
export function VerifiedBadge({ description, display = 'icon', className }: VerifiedBadgeProps) {
  const t = useTranslations('web.ui.verified');
  const text = description ?? t('description');
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = (delay: number) => {
    setArmed(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };
  return (
    // Hover and focus only show the tooltip of the badge, which names itself (WCAG 1.4.13).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <span
      // Focusable so that the explanation reaches the keyboard (WCAG 1.4.13).
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      role="img"
      aria-label={text}
      onPointerEnter={(event) => event.pointerType === 'mouse' && show(DELAY_MS)}
      onPointerLeave={hide}
      onFocus={(event) => event.currentTarget.matches(':focus-visible') && show(0)}
      onBlur={hide}
      onKeyDown={(event) => event.key === 'Escape' && hide()}
      className={cn(
        'relative inline-flex items-center gap-1 rounded-full text-accent outline-none focus-visible:outline-2 focus-visible:outline-focus',
        className,
      )}
    >
      <BadgeCheck aria-hidden className="size-5" />
      {display === 'label' ? (
        <span aria-hidden className="text-xs font-medium">
          {t('label')}
        </span>
      ) : null}
      {armed ? (
        <Suspense fallback={null}>
          <TooltipLayer open={open} content={text} side="top" />
        </Suspense>
      ) : null}
    </span>
  );
}

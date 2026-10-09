'use client';

import { useFormatter, useNow } from 'next-intl';
import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { preloadWhenIdle } from '@/lib/preload';

/** The positioned tooltip loads with the first hover or focus (a feed holds dozens of dates). */
const loadLayer = () => import('./lazy-tooltip');
const TooltipLayer = lazy(loadLayer);

const DELAY_MS = 400;

/**
 * "il y a 5 minutes", kept up to date every minute; the full date and time in the time zone of
 * the member in the `datetime` attribute, as the description of the date, and in a tooltip on
 * hover and keyboard focus (Escape closes it, WCAG 1.4.13). The tooltip is mounted on first use
 * only: a page with many dates hydrates none of them.
 */
export function RelativeTime({ date, className }: { date: string; className?: string }) {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => preloadWhenIdle(loadLayer), []);
  // Escape closes the tooltip wherever the focus is (WCAG 1.4.13).
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);

  // Hover and focus show the tooltip: listened on the date, which only describes itself.
  const element = useRef<HTMLTimeElement>(null);
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    const show = (delay: number) => {
      setArmed(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setOpen(true), delay);
    };
    const hide = () => {
      clearTimeout(timer.current);
      setOpen(false);
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') show(DELAY_MS);
    };
    const focus = () => {
      if (target.matches(':focus-visible')) show(0);
    };
    target.addEventListener('pointerenter', enter);
    target.addEventListener('pointerleave', hide);
    target.addEventListener('focus', focus);
    target.addEventListener('blur', hide);
    return () => {
      target.removeEventListener('pointerenter', enter);
      target.removeEventListener('pointerleave', hide);
      target.removeEventListener('focus', focus);
      target.removeEventListener('blur', hide);
    };
  }, []);

  const instant = new Date(date);
  const full = format.dateTime(instant, { dateStyle: 'full', timeStyle: 'short' });

  return (
    <span className="relative inline-flex">
      <time
        dateTime={date}
        // Focusable so that the full date shows to the keyboard too (WCAG 1.4.13).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        aria-describedby={descriptionId}
        // The server and the browser read the clock a few seconds apart: « il y a 3 secondes »
        // may become « il y a 5 secondes ». The text of the server stays until the next minute.
        suppressHydrationWarning
        ref={element}
        className={cn('rounded-xs', className)}
      >
        {format.relativeTime(instant, now)}
      </time>
      <span id={descriptionId} hidden>
        {full}
      </span>
      {armed ? (
        <Suspense fallback={null}>
          <TooltipLayer open={open} content={full} side="top" />
        </Suspense>
      ) : null}
    </span>
  );
}

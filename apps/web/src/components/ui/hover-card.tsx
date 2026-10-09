'use client';

import { Slot } from 'radix-ui';
import {
  type ComponentProps,
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react';
import type HoverCardLayer from './hover-card-layer';

const loadLayer = () => import('./hover-card-layer');
const Layer = lazy(loadLayer);

const OPEN_DELAY_MS = 500;
const CLOSE_DELAY_MS = 150;

interface HoverCardProps {
  /** A link to the full content: the card is a preview, never the only way to it. */
  trigger: ReactNode;
  children: ReactNode;
  side?: ComponentProps<typeof HoverCardLayer>['side'];
  /** Told when the card opens and closes: what it shows can load at its first opening. */
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * Preview on hover and keyboard focus (500 ms): a profile, a project. Pointer devices and
 * keyboard only: on a touch screen the link opens the page itself. The trigger renders at once;
 * the card (Radix HoverCard and its positioning) loads at the first hover or focus (ADR 0094).
 */
export function HoverCard({
  trigger,
  children,
  side = 'bottom',
  onOpenChange,
  className,
}: HoverCardProps) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const change = (next: boolean) => {
    clearTimeout(timer.current);
    setOpen(next);
    onOpenChange?.(next);
  };
  const later = (next: boolean, delay: number) => {
    if (next) setArmed(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => change(next), delay);
  };

  return (
    <span className="relative inline-flex min-w-0">
      <Slot.Root
        onPointerEnter={(event: { pointerType: string }) => {
          if (event.pointerType === 'mouse') later(true, OPEN_DELAY_MS);
        }}
        onPointerLeave={() => later(false, CLOSE_DELAY_MS)}
        onFocus={(event: { currentTarget: Element }) => {
          if (event.currentTarget.matches(':focus-visible')) later(true, OPEN_DELAY_MS);
        }}
        onBlur={() => later(false, CLOSE_DELAY_MS)}
      >
        {trigger}
      </Slot.Root>
      {armed ? (
        <Suspense fallback={null}>
          <Layer
            open={open}
            // The card keeps itself open while the pointer is in it, and closes on Escape.
            onOpenChange={(next) => (next ? clearTimeout(timer.current) : later(false, 0))}
            side={side}
            {...(className ? { className } : {})}
          >
            {children}
          </Layer>
        </Suspense>
      ) : null}
    </span>
  );
}

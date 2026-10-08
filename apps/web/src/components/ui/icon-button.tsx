'use client';

import {
  type ComponentProps,
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/cn';
import { preloadWhenIdle } from '@/lib/preload';
import { Button } from './button';

/** The positioned tooltip stays out of the first load; it arrives when the page is idle. */
const loadLayer = () => import('./lazy-tooltip');
const TooltipLayer = lazy(loadLayer);

const DELAY_MS = 400;

type IconButtonProps = Omit<ComponentProps<typeof Button>, 'children' | 'size' | 'asChild'> & {
  /** Accessible name, required: the button has no visible text. */
  label: string;
  /** A lucide icon element (decorative: the label names the button). */
  icon: ReactNode;
  size?: 'md' | 'sm';
  /** Tooltip text, the label by default. */
  tooltip?: ReactNode;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
};

/**
 * Button with an icon only: its label is its accessible name and its tooltip on hover (after a
 * short delay) and on keyboard focus, dismissed by Escape (WCAG 1.4.13). 44 px on a phone
 * whatever the size. The tooltip code loads when the page is idle (ADR 0094).
 */
export function IconButton({
  label,
  icon,
  size = 'md',
  variant = 'ghost',
  tooltip,
  tooltipSide = 'bottom',
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  onKeyDown,
  className,
  ...props
}: IconButtonProps) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => preloadWhenIdle(loadLayer), []);

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
    // Placement classes (absolute, hidden at a breakpoint) apply to the whole, tooltip included.
    <span className={cn('relative inline-flex', className)}>
      <Button
        variant={variant}
        size={size === 'sm' ? 'icon-sm' : 'icon'}
        aria-label={label}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') show(DELAY_MS);
          onPointerEnter?.(event);
        }}
        onPointerLeave={(event) => {
          hide();
          onPointerLeave?.(event);
        }}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible')) show(0);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          hide();
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) hide();
          onKeyDown?.(event);
        }}
        {...props}
      >
        {icon}
      </Button>
      {armed ? (
        <Suspense fallback={null}>
          <TooltipLayer open={open} content={tooltip ?? label} side={tooltipSide} />
        </Suspense>
      ) : null}
    </span>
  );
}

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { HorizontalMark, MicroMark, SymbolMark } from './marks.generated';

interface Mark {
  viewBox: string;
  body: ReactNode;
}

interface MarkProps {
  /** Accessible name; omitted when the mark sits in a link or a heading that already names it. */
  label?: string | undefined;
  className?: string | undefined;
  /** Allowed animation of the brand guide: fade in 180 to 250 ms, rise of 8 px at most. */
  animated?: boolean | undefined;
}

function renderMark(mark: Mark, width: number, { label, className, animated }: MarkProps) {
  const [, , viewWidth = 1, viewHeight = 1] = mark.viewBox.split(' ').map(Number);
  return (
    <svg
      viewBox={mark.viewBox}
      width={width}
      height={Math.round((width * viewHeight) / viewWidth)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      // Counted by the review captures: one logo per screen (docs/design/review).
      data-brand-mark=""
      className={cn('shrink-0', animated && 'animate-brand-enter', className)}
    >
      {mark.body}
    </svg>
  );
}

/**
 * Minimum widths of the brand guide, for the visible drawing; the files keep their protection
 * margin, hence the rendered widths below (visible share: 94.7 % horizontal, 75.8 % symbol).
 */
export const BRAND_MIN_WIDTH = { horizontal: 240, symbol: 64, micro: 16 } as const;

/** Main horizontal logo, aligned left in the interface (brand guide). */
export function BrandLogo({
  width = BRAND_MIN_WIDTH.horizontal,
  ...props
}: MarkProps & { width?: number }) {
  return renderMark(HorizontalMark, Math.max(width, BRAND_MIN_WIDTH.horizontal), props);
}

/** Symbol alone, for the collapsed navigation. */
export function BrandSymbol({
  width = BRAND_MIN_WIDTH.symbol,
  ...props
}: MarkProps & { width?: number }) {
  return renderMark(SymbolMark, Math.max(width, BRAND_MIN_WIDTH.symbol), props);
}

/** Optical adaptation for 16 to 32 px, monochrome (violet, or brand white on dark). */
export function BrandMicro({ size = 24, ...props }: MarkProps & { size?: 16 | 24 | 32 }) {
  return renderMark(MicroMark, size, props);
}

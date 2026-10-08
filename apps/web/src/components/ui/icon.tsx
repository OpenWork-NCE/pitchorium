import type { LucideIcon, LucideProps } from 'lucide-react';
import { cn } from '@/lib/cn';

/** The three sizes of docs/design/direction.md, in pixels. */
export const ICON_SIZES = { sm: 16, md: 20, lg: 24 } as const;

type IconProps = Omit<LucideProps, 'size' | 'ref'> & {
  icon: LucideIcon;
  size?: keyof typeof ICON_SIZES;
  /** Accessible name of an icon that carries meaning on its own; decorative without it. */
  label?: string;
};

/**
 * A lucide icon at a normalised size, with the single stroke of the design system (1.75, set in
 * globals.css). Decorative unless it has a label.
 */
export function Icon({ icon: Glyph, size = 'md', label, className, ...props }: IconProps) {
  return (
    <Glyph
      width={ICON_SIZES[size]}
      height={ICON_SIZES[size]}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
      className={cn('shrink-0', className)}
      {...props}
    />
  );
}

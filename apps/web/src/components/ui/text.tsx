import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const textVariants = cva('', {
  variants: {
    size: { xs: 'text-xs', sm: 'text-sm', base: 'text-base', lg: 'text-lg' },
    tone: {
      default: 'text-foreground',
      muted: 'text-muted',
      accent: 'text-accent',
      success: 'text-success',
      warning: 'text-warning',
      danger: 'text-danger',
    },
    weight: { regular: 'font-normal', medium: 'font-medium', semibold: 'font-semibold' },
    /** Long text: limited to 68 characters per line. */
    prose: { true: 'max-w-[68ch] text-pretty', false: '' },
    /** Figures of the same width, for amounts and counters. */
    numeric: { true: 'font-numeric tabular-nums', false: '' },
  },
  defaultVariants: {
    size: 'base',
    tone: 'default',
    weight: 'regular',
    prose: false,
    numeric: false,
  },
});

type TextProps = Omit<ComponentProps<'p'>, 'color'> &
  VariantProps<typeof textVariants> & {
    as?: 'p' | 'span' | 'div' | 'small' | 'strong' | 'em';
  };

/** Running text in Poppins: sizes and tones of docs/design/direction.md only. */
export function Text({
  as: Tag = 'p',
  size,
  tone,
  weight,
  prose,
  numeric,
  className,
  ...props
}: TextProps) {
  return (
    <Tag
      className={cn(textVariants({ size, tone, weight, prose, numeric }), className)}
      {...props}
    />
  );
}

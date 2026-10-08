import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import {
  Children,
  cloneElement,
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

export const buttonVariants = cva(
  'relative isolate inline-flex shrink-0 press cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full font-medium whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-on-accent',
        secondary: 'border border-border-strong bg-surface text-foreground hover:bg-surface-sunken',
        ghost: 'text-foreground hover:bg-surface-sunken',
        subtle: 'bg-accent-subtle text-on-accent-subtle hover:bg-accent-subtle/80',
        danger: 'bg-danger text-on-status',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Renders the only child (a link) with the button styles. */
    asChild?: boolean;
  };

/** Label and its copy in the fill colour, revealed by a circle from the bottom (H21). */
function withFill(children: ReactNode): ReactNode {
  return (
    <>
      <span className="relative z-[1] inline-flex items-center gap-[inherit]">{children}</span>
      <span aria-hidden className="circle-fill">
        {children}
      </span>
    </>
  );
}

/**
 * Button of the design system: press scale on every variant; the primary one fills with copper
 * from the bottom on hover (H21), animating `clip-path` only. Styles of `.press` and
 * `.circle-fill` in globals.css.
 */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  children,
  ...props
}: ButtonProps) {
  const fill = (variant ?? 'primary') === 'primary' && size !== 'icon';
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    const child = Children.only(children) as ReactElement<{ children?: ReactNode }>;
    const content =
      isValidElement(child) && fill ? withFill(child.props.children) : child.props.children;
    return (
      <Slot.Root className={classes} data-fill={fill ? '' : undefined} {...props}>
        {cloneElement(child, undefined, content)}
      </Slot.Root>
    );
  }
  return (
    <button type="button" className={classes} data-fill={fill ? '' : undefined} {...props}>
      {fill ? withFill(children) : children}
    </button>
  );
}

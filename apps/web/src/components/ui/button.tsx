import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import {
  Children,
  cloneElement,
  type ComponentProps,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  useId,
} from 'react';
import { cn } from '@/lib/cn';
import { ReasonTooltip } from './reason-tooltip';
import { Spinner } from './spinner';

export const buttonVariants = cva(
  'relative isolate inline-flex shrink-0 press cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full font-medium whitespace-nowrap select-none disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /** The main action of a view, once per view: violet, copper fill on hover (H21). */
        primary: 'bg-accent text-on-accent',
        /** A second action next to the primary one. */
        secondary: 'bg-accent-subtle text-on-accent-subtle hover:bg-accent-subtle/70',
        /** A neutral action on any surface. */
        outline: 'border border-border-strong bg-surface text-foreground hover:bg-surface-sunken',
        /** A light action in a toolbar, a header or a list. */
        ghost: 'text-foreground hover:bg-surface-sunken',
        /** A destructive action, confirmed by an AlertDialog. */
        danger: 'bg-danger text-on-status hover:bg-danger/90',
        /** An action that reads as a link (inside a sentence). */
        link: 'h-auto rounded-xs link-underline-hover px-0 text-link',
      },
      size: {
        sm: 'h-9 px-4 text-sm max-sm:h-11 [&_svg]:size-4',
        md: 'h-11 px-5 text-sm [&_svg]:size-4',
        lg: 'h-12 px-6 text-base [&_svg]:size-5',
        icon: 'size-11 [&_svg]:size-5',
        'icon-sm': 'size-9 max-sm:size-11 [&_svg]:size-4',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Renders the only child (a link) with the button styles. */
    asChild?: boolean;
    /** Action in progress: a spinner over the label, same width, the button busy and inert. */
    loading?: boolean;
    /** Announced text of the spinner (translated), with `loading`. */
    loadingLabel?: string;
    /**
     * Why the action is not available: the button stays focusable (`aria-disabled`), the reason
     * is announced (`aria-describedby`) and shown in a tooltip on hover and focus.
     */
    disabledReason?: string;
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

/** The label stays in place, invisible, under the spinner: the button keeps its width. */
function withSpinner(children: ReactNode, label: string | undefined): ReactNode {
  return (
    <>
      <span className="invisible inline-flex items-center gap-[inherit]">{children}</span>
      <span className="absolute inset-0 inline-flex items-center justify-center">
        <Spinner size="sm" label={label} />
      </span>
    </>
  );
}

/**
 * Button of the design system: press scale on every variant; the primary one fills with copper
 * from the bottom on hover (H21), animating `clip-path` only. Styles of `.press` and
 * `.circle-fill` in globals.css; catalogue in docs/design/components.md.
 */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingLabel,
  disabledReason,
  children,
  onClick,
  'aria-describedby': describedBy,
  ...props
}: ButtonProps) {
  const reasonId = useId();
  const isIcon = size === 'icon' || size === 'icon-sm';
  const fill = (variant ?? 'primary') === 'primary' && !isIcon && !loading && !disabledReason;
  const classes = cn(buttonVariants({ variant, size }), className);
  const blocked = loading || Boolean(disabledReason);

  if (asChild) {
    const child = Children.only(children) as ReactElement<{ children?: ReactNode }>;
    const content =
      isValidElement(child) && fill ? withFill(child.props.children) : child.props.children;
    return (
      <Slot.Root
        className={classes}
        data-fill={fill ? '' : undefined}
        aria-describedby={describedBy}
        {...props}
      >
        {cloneElement(child, undefined, content)}
      </Slot.Root>
    );
  }

  const content = loading
    ? withSpinner(children, loadingLabel)
    : fill
      ? withFill(children)
      : children;
  const button = (
    <button
      type="button"
      className={classes}
      data-fill={fill ? '' : undefined}
      aria-describedby={disabledReason ? cn(reasonId, describedBy) : describedBy}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (blocked) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
      aria-busy={loading || undefined}
      aria-disabled={blocked || props['aria-disabled'] || undefined}
    >
      {content}
    </button>
  );

  if (!disabledReason) return button;
  return (
    <>
      <ReasonTooltip reason={disabledReason}>{button}</ReasonTooltip>
      <span id={reasonId} className="sr-only">
        {disabledReason}
      </span>
    </>
  );
}

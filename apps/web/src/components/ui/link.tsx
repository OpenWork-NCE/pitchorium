import { ArrowUpRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Link as LocaleLink } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

type LinkProps = Omit<ComponentProps<'a'>, 'href'> & {
  href: string;
  children: ReactNode;
  /**
   * `inline`: inside a text, underlined at rest; `standalone`: on its own (lists, navigation),
   * underlined on hover and focus only.
   */
  variant?: 'inline' | 'standalone';
  /** Opens another site in a new tab; the caller gives the announced text of that tab. */
  external?: { newTabLabel: string };
};

/**
 * Link of the design system: the underline is drawn from the left on hover (motion catalogue).
 * Internal paths go through the locale-aware link; external ones open a new tab with
 * `noopener noreferrer`, an arrow and an announced warning.
 */
export function Link({
  href,
  children,
  variant = 'inline',
  external,
  className,
  ...props
}: LinkProps) {
  const classes = cn(
    'rounded-xs text-link',
    variant === 'inline' ? 'link-underline' : 'link-underline-hover',
    className,
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes} {...props}>
        {children}
        <ArrowUpRight aria-hidden className="ml-0.5 inline size-[0.9em] align-[-0.1em]" />
        <span className="sr-only">{` (${external.newTabLabel})`}</span>
      </a>
    );
  }
  return (
    <LocaleLink href={href} className={classes} {...props}>
      {children}
    </LocaleLink>
  );
}

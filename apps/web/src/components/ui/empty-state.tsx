import type { ReactNode } from 'react';
import { preload } from 'react-dom';
import { cn } from '@/lib/cn';

/** The motif of the kit (public/brand, pnpm brand:sync), the same file at every size. */
const MOTIF = '/brand/overlay-mobile.svg';

interface EmptyStateProps {
  /** What is missing ("Aucune conversation pour l'instant"). */
  title: ReactNode;
  /** Why, and what fills it. */
  description?: ReactNode;
  /** The action that fills it, when the person can. */
  action?: ReactNode;
  /** A lucide icon element of the subject (decorative). */
  icon?: ReactNode;
  /** Heading level in the outline of the page. */
  headingLevel?: 2 | 3;
  /** `inline` inside a card or a table, smaller and without the motif. */
  size?: 'page' | 'inline';
  className?: string;
}

/**
 * Empty state on the elevation motif of the brand (the overlay of the kit, direction.md), never a
 * generic picture: says what is missing, why, and the action that fills it.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  headingLevel = 2,
  size = 'page',
  className,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  // Announced in the head: a background found late in the styles would delay the page.
  if (size === 'page') preload(MOTIF, { as: 'image', fetchPriority: 'high' });
  return (
    <div
      className={cn(
        'relative grid justify-items-center gap-3 overflow-hidden rounded-xl text-center',
        size === 'page' ? 'border border-border bg-surface px-6 py-14' : 'px-4 py-8',
        className,
      )}
    >
      {size === 'page' ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url(/brand/overlay-mobile.svg)] bg-size-[140%_auto] bg-position-[center_75%] bg-no-repeat"
        />
      ) : null}
      {icon ? (
        <span
          aria-hidden
          className="relative flex size-12 items-center justify-center rounded-full bg-accent-subtle text-on-accent-subtle [&_svg]:size-6"
        >
          {icon}
        </span>
      ) : null}
      <Heading
        className={cn(
          'relative font-sans font-semibold text-balance',
          size === 'page' ? 'text-xl' : 'text-base',
        )}
      >
        {title}
      </Heading>
      {description ? <p className="relative max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="relative mt-2">{action}</div> : null}
    </div>
  );
}

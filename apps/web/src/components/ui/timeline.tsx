import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TimelineEntry {
  id: string;
  title: ReactNode;
  /** When, already formatted (a `time` element, a RelativeTime). */
  when: ReactNode;
  body?: ReactNode;
  /** An icon element; a dot without it. */
  icon?: ReactNode;
  tone?: 'default' | 'accent' | 'success' | 'danger';
}

const DOTS = {
  default: 'bg-surface-sunken text-muted',
  accent: 'bg-accent-subtle text-on-accent-subtle',
  success: 'bg-success-subtle text-success',
  danger: 'bg-danger-subtle text-danger',
} as const;

/** Events in order (history of a campaign, of a moderation case): an ordered list with a rail. */
export function Timeline({
  entries,
  className,
}: {
  entries: readonly TimelineEntry[];
  className?: string;
}) {
  return (
    <ol className={cn('grid', className)}>
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative grid grid-cols-[2rem_1fr] gap-x-3 pb-6 last:pb-0">
          {index < entries.length - 1 ? (
            <span
              aria-hidden
              className="absolute top-8 bottom-0 left-4 w-px -translate-x-1/2 bg-border"
            />
          ) : null}
          <span
            aria-hidden
            className={cn(
              'relative flex size-8 items-center justify-center rounded-full [&_svg]:size-4',
              DOTS[entry.tone ?? 'default'],
            )}
          >
            {entry.icon ?? <span className="size-2 rounded-full bg-current" />}
          </span>
          <div className="grid gap-1 pt-1">
            <p className="text-sm font-medium">{entry.title}</p>
            <p className="text-xs text-muted">{entry.when}</p>
            {entry.body ? <div className="mt-1 text-sm text-foreground">{entry.body}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

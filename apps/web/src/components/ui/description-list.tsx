import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface DescriptionListProps {
  items: readonly { term: ReactNode; description: ReactNode; key?: string }[];
  /** `columns`: term and description side by side from `sm`; `stacked`: one under the other. */
  layout?: 'columns' | 'stacked';
  className?: string;
}

/** Pairs of a term and its value (details of a profile, of a project): a real `dl`. */
export function DescriptionList({ items, layout = 'columns', className }: DescriptionListProps) {
  return (
    <dl
      className={cn(
        'grid',
        layout === 'columns' ? 'gap-y-3 sm:grid-cols-[minmax(8rem,auto)_1fr] sm:gap-x-6' : 'gap-4',
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          // The caller may pass a key; the order of the pairs is otherwise stable.
          key={item.key ?? index}
          className={cn(
            'grid gap-0.5',
            layout === 'columns' && 'sm:col-span-2 sm:grid-cols-subgrid',
          )}
        >
          <dt className="text-sm text-muted">{item.term}</dt>
          <dd className="text-sm text-foreground">{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}

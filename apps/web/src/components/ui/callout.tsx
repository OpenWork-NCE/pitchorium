import { Lightbulb } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CalloutProps {
  title?: ReactNode;
  children: ReactNode;
  /** An icon element; a light bulb by default. */
  icon?: ReactNode;
  className?: string;
}

/** A side explanation in a page (how a score is computed, what a step involves): never an error. */
export function Callout({ title, children, icon, className }: CalloutProps) {
  return (
    <aside
      className={cn(
        'flex items-start gap-3 rounded-lg border-l-2 border-accent bg-accent-subtle/50 p-4 text-sm',
        className,
      )}
    >
      <span aria-hidden className="mt-0.5 text-accent [&_svg]:size-5">
        {icon ?? <Lightbulb />}
      </span>
      <div className="grid gap-1">
        {title ? <p className="font-semibold text-foreground">{title}</p> : null}
        <div className="text-foreground">{children}</div>
      </div>
    </aside>
  );
}

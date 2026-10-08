import { cn } from '@/lib/cn';

interface CountBadgeProps {
  count: number;
  /** Beyond it, `99+`. */
  max?: number;
  className?: string;
}

/**
 * Number of things to act on (unread messages, notifications), on a navigation item. A new value
 * rolls in from below (the key changes, CSS `count-roll`); nothing with less motion. Decorative:
 * the item says the count in its accessible name.
 */
export function CountBadge({ count, max = 99, className }: CountBadgeProps) {
  if (count <= 0) return null;
  const text = count > max ? `${max}+` : String(count);
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center overflow-hidden rounded-full bg-accent px-1.5 text-[0.6875rem] leading-none font-semibold text-on-accent tabular-nums ring-2 ring-background',
        className,
      )}
    >
      <span key={text} className="count-roll">
        {text}
      </span>
    </span>
  );
}

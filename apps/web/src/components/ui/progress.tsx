import { cn } from '@/lib/cn';

interface ProgressProps {
  /** 0 to `max`; null for an indeterminate wait. */
  value: number | null;
  max?: number;
  /** Accessible name of the bar ("Envoi de photo.jpg"). */
  label: string;
  /** Spoken value ("42 %"). */
  valueText?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Progress of a known task (`role=progressbar`, the attributes Radix Progress gave it), or a wait
 * without a measure. Without state of its own, a server component renders it: the strength of a
 * profile ships no code to the browser.
 */
export function Progress({
  value,
  max = 100,
  label,
  valueText,
  size = 'md',
  className,
}: ProgressProps) {
  const percent = value === null ? null : Math.min(100, Math.max(0, (value / max) * 100));
  const state = percent === null ? 'indeterminate' : percent >= 100 ? 'complete' : 'loading';
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value ?? undefined}
      aria-valuetext={percent === null ? undefined : (valueText ?? `${Math.round(percent)}%`)}
      data-state={state}
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-track',
        size === 'sm' ? 'h-1' : 'h-2',
        className,
      )}
    >
      <div
        data-state={state}
        className={cn(
          'h-full rounded-full bg-accent transition-transform duration-(--duration-page) ease-(--ease-enter)',
          percent === null && 'w-1/3 animate-[loading-bar_1.2s_var(--ease-curtain)_infinite]',
        )}
        style={percent === null ? undefined : { transform: `translateX(-${100 - percent}%)` }}
      />
    </div>
  );
}

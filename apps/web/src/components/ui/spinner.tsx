import { cn } from '@/lib/cn';

interface SpinnerProps {
  /** Announced text; absent when the spinner sits in a control that announces itself. */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: 'size-4', md: 'size-5', lg: 'size-6' } as const;

/**
 * Turning arc for an action in progress in a button or a small area (docs/design/direction.md:
 * skeletons for the content). Still with less motion, the arc stays visible.
 */
export function Spinner({ label, size = 'md', className }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      className={cn('inline-flex items-center justify-center', className)}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn('animate-spin', SIZES[size])}>
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="2.5"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

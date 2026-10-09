import { cn } from '@/lib/cn';

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Progress of a file being sent (motion catalogue): a ring that fills to the share sent, its
 * stroke gliding (`--duration-page`); `null` for a wait of unknown length (the checks of the
 * server), a quarter that turns. A progressbar, its value said in words.
 */
export function ProgressRing({
  value,
  label,
  valueText,
  className,
}: {
  /** 0 to 1, null while the length of the wait is unknown. */
  value: number | null;
  label: string;
  valueText?: string;
  className?: string;
}) {
  const share = value === null ? 0.25 : Math.min(1, Math.max(0, value));
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(share * 100)}
      aria-valuetext={valueText}
      className={cn('inline-grid size-12 place-items-center', className)}
    >
      <svg
        viewBox="0 0 48 48"
        aria-hidden
        className={cn('size-full', value === null && 'animate-spin')}
      >
        <circle cx="24" cy="24" r={RADIUS} fill="none" strokeWidth="4" className="stroke-track" />
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - share)}
          transform="rotate(-90 24 24)"
          className="stroke-accent transition-[stroke-dashoffset] duration-(--duration-page) ease-(--ease-enter)"
        />
      </svg>
    </span>
  );
}

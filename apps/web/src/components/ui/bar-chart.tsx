'use client';

import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { cn } from '@/lib/cn';
import { useMotionPreference } from '@/components/motion';
import { barHeights, chartTicks, isEmptySeries } from './chart-scale';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { Loading, Skeleton } from './skeleton';

/** One bar: its value for drawing and every text the caller already formatted. */
export interface BarChartDatum {
  /** Stable key (`2026-05`, `2026-10-07`). */
  key: string;
  /** Integer value: a count, or an amount in minor units; drawn only, never added up here. */
  value: number;
  /** Short label of the horizontal axis (« mai », « 7 oct. »). */
  label: string;
  /** Full label of the tooltip and the table (« mai 2026 », « mardi 7 octobre »). */
  description: string;
  /** The value as written (« 120 € », « 312 membres »). */
  formatted: string;
}

interface BarChartProps {
  /** The series; `undefined` while it loads. */
  data: readonly BarChartDatum[] | undefined;
  /**
   * Accessible name of the figure. Visible as its title only with `showTitle`: one title per
   * chart, carried by the card or by the chart, never both.
   */
  title: string;
  showTitle?: boolean;
  /** Key figures written above the chart (« 2 350 € versés sur 12 mois · pic en août »). */
  summary?: ReactNode;
  /** Text of a graduation of the vertical axis (compact numbers, currency). */
  formatTick: (value: number) => string;
  /** Headers of the table read by screen readers. */
  columns: { category: string; value: string };
  state?: 'ready' | 'loading' | 'error';
  onRetry?: () => void;
  /** Nothing to draw (no value above zero): what is missing and the action that fills it. */
  empty: { title: ReactNode; description?: ReactNode; action?: ReactNode };
  /** Level of the title of the empty and error states in the outline of the page. */
  headingLevel?: 2 | 3;
  className?: string;
}

const noop = () => () => undefined;

/**
 * How the bars arrive: `rise` on a fresh mount in the browser (a dialog), `wait` then `rise` for a
 * chart rendered by the server out of the screen, `still` otherwise: the first paint of a server
 * render is always the final state (motion.md), and nothing moves with less motion.
 */
function useEntry(reduced: boolean) {
  // True on a mount in the browser, false while hydrating a server render.
  const fresh = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [entry, setEntry] = useState<'still' | 'wait' | 'rise'>(() =>
    fresh && !reduced ? 'rise' : 'still',
  );
  const ref = useRef<HTMLElement>(null);
  const hydrated = useRef(!fresh);
  useEffect(() => {
    const element = ref.current;
    if (!hydrated.current || reduced || !element || !('IntersectionObserver' in window)) return;
    hydrated.current = false;
    const box = element.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) return;
    setEntry('wait');
    const observer = new IntersectionObserver(([first]) => {
      if (!first?.isIntersecting) return;
      setEntry('rise');
      observer.disconnect();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduced]);
  return { entry, ref };
}

/**
 * Bar chart of the design system (ADR 0144), in SVG without a charting library: the key figures
 * above it, a vertical axis graduated in round values written by the caller (currency, compact
 * numbers, tabular figures), discreet guide lines, the short labels of the horizontal axis (one
 * out of two on a phone when there are many), the value of each bar on hover and on keyboard focus
 * (one stop, arrows to move), a table for screen readers. Loading as a skeleton of its shape, an
 * error with a retry, an empty state instead of empty axes.
 */
export function BarChart({
  data,
  title,
  showTitle = false,
  summary,
  formatTick,
  columns,
  state = 'ready',
  onRetry,
  empty,
  headingLevel = 3,
  className,
}: BarChartProps) {
  const id = useId();
  const reduced = useMotionPreference() === 'reduced';
  const { entry, ref } = useEntry(reduced);
  const [active, setActive] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  if (state === 'loading' || (state === 'ready' && data === undefined)) {
    return <BarChartSkeleton className={className} />;
  }
  if (state === 'error') {
    return <ErrorState size="inline" headingLevel={headingLevel} onRetry={onRetry} />;
  }
  const series = data ?? [];
  const values = series.map((datum) => datum.value);
  if (isEmptySeries(values)) {
    return (
      <EmptyState
        size="inline"
        headingLevel={headingLevel}
        title={empty.title}
        description={empty.description}
        action={empty.action}
        className={className}
      />
    );
  }

  const ticks = chartTicks(Math.max(...values));
  const top = ticks.at(-1)!;
  const heights = barHeights(values, top);
  const count = series.length;
  // On a phone, one label out of two when there are many, always the last (the current period).
  const thin = count > 7;
  const move = (event: KeyboardEvent, index: number) => {
    const next =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? Math.min(count - 1, index + 1)
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? Math.max(0, index - 1)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : null;
    if (next === null) {
      if (event.key === 'Escape') setActive(null);
      return;
    }
    event.preventDefault();
    setFocusIndex(next);
    setActive(next);
    buttons.current[next]?.focus();
  };
  const tooltipId = `${id}-tooltip`;
  const shown = active === null ? null : series[active];

  return (
    <figure
      ref={ref}
      className={cn('grid gap-4', className)}
      aria-labelledby={`${id}-title`}
      data-chart=""
      data-entry={entry}
    >
      <figcaption className="grid gap-1">
        <span id={`${id}-title`} className={showTitle ? 'text-base font-semibold' : 'sr-only'}>
          {title}
        </span>
        {summary ? <span className="text-sm text-muted">{summary}</span> : null}
      </figcaption>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
        {/* Vertical axis: graduations aligned on their guide line. */}
        <div className="relative h-44 sm:h-52" aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 translate-y-1/2 font-numeric text-xs leading-none whitespace-nowrap text-muted tabular-nums"
              style={{ bottom: `${(tick / top) * 100}%` }}
            >
              {formatTick(tick)}
            </span>
          ))}
          {/* Width of the widest graduation, so that the column never collapses. */}
          <span className="invisible block h-0 font-numeric text-xs whitespace-nowrap tabular-nums">
            {formatTick(top)}
          </span>
        </div>
        <div className="relative h-44 sm:h-52">
          <svg
            className="absolute inset-0 size-full overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            {ticks.map((tick) => (
              <line
                key={tick}
                x1="0"
                x2="100"
                y1={100 - (tick / top) * 100}
                y2={100 - (tick / top) * 100}
                vectorEffect="non-scaling-stroke"
                className={tick === 0 ? 'stroke-border-strong' : 'stroke-border'}
                strokeDasharray={tick === 0 ? undefined : '3 4'}
                strokeWidth="1"
              />
            ))}
            {series.map((datum, index) => {
              const slot = 100 / count;
              const height = heights[index]!;
              return (
                <rect
                  key={datum.key}
                  x={index * slot + slot * 0.2}
                  width={slot * 0.6}
                  y={100 - height}
                  height={height}
                  className={cn(
                    'chart-bar transition-[fill] duration-(--duration-micro)',
                    active === index ? 'fill-accent-strong' : 'fill-accent',
                  )}
                  style={entry === 'rise' ? { animationDelay: `${index * 30}ms` } : undefined}
                />
              );
            })}
          </svg>
          {/* One target per column, the whole height: hover anywhere, one keyboard stop. */}
          <div
            className="absolute inset-0 flex"
            role="group"
            aria-label={title}
            onPointerLeave={() => setActive(null)}
          >
            {series.map((datum, index) => (
              <button
                key={datum.key}
                ref={(element) => {
                  buttons.current[index] = element;
                }}
                type="button"
                tabIndex={index === focusIndex ? 0 : -1}
                aria-label={`${datum.description} : ${datum.formatted}`}
                aria-describedby={active === index ? tooltipId : undefined}
                className="h-full min-w-0 flex-1 cursor-default rounded-sm outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
                onPointerEnter={() => setActive(index)}
                onFocus={(event) => {
                  setFocusIndex(index);
                  // A dialog that opens on the chart focuses it without the keyboard: no tooltip.
                  if (event.currentTarget.matches(':focus-visible')) setActive(index);
                }}
                onBlur={() => setActive(null)}
                onKeyDown={(event) => move(event, index)}
              />
            ))}
          </div>
          {shown && active !== null ? (
            <div
              id={tooltipId}
              role="tooltip"
              className={cn(
                'pointer-events-none absolute z-10 grid min-w-max gap-0.5 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs shadow-md',
                active < count / 4
                  ? 'translate-x-0'
                  : active >= (count * 3) / 4
                    ? '-translate-x-full'
                    : '-translate-x-1/2',
              )}
              style={{
                left: `${active < count / 4 ? (active / count) * 100 : active >= (count * 3) / 4 ? ((active + 1) / count) * 100 : ((active + 0.5) / count) * 100}%`,
                bottom: `calc(${heights[active]}% + 0.5rem)`,
              }}
            >
              <span className="text-muted">{shown.description}</span>
              <span className="font-numeric text-sm font-semibold tabular-nums">
                {shown.formatted}
              </span>
            </div>
          ) : null}
        </div>
        <span aria-hidden />
        {/* Horizontal axis. */}
        <div
          className="mt-2 grid text-xs text-muted"
          style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
          aria-hidden
        >
          {series.map((datum, index) => (
            <span
              key={datum.key}
              className={cn(
                'truncate text-center',
                thin && (count - 1 - index) % 2 === 1 && 'max-sm:invisible',
              )}
            >
              {datum.label}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{columns.category}</th>
            <th scope="col">{columns.value}</th>
          </tr>
        </thead>
        <tbody>
          {series.map((datum) => (
            <tr key={datum.key}>
              <th scope="row">{datum.description}</th>
              <td>{datum.formatted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

const SKELETON_BARS = [35, 60, 45, 80, 55, 70, 40];

/** The chart while its series loads: the summary line, the axes and bars of its shape. */
export function BarChartSkeleton({ className }: { className?: string }) {
  return (
    <Loading className={cn('grid gap-4', className)}>
      <Skeleton className="h-4 w-2/3 max-w-80" />
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3">
        <div className="grid h-44 content-between py-0.5 sm:h-52">
          {[0, 1, 2, 3].map((line) => (
            <Skeleton key={line} className="h-3 w-full" />
          ))}
        </div>
        <div className="flex h-44 items-end gap-[4%] border-b border-border px-[2%] sm:h-52">
          {SKELETON_BARS.map((height, index) => (
            <Skeleton
              key={index}
              className="flex-1 rounded-b-none"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <span />
        <Skeleton className="mt-2 h-3 w-full" />
      </div>
    </Loading>
  );
}

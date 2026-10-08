'use client';

import type { MoneyDto } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedNumber, DURATION_MS, useMotionPreference } from '@/components/motion';
import { cn } from '@/lib/cn';
import { formatMoney, isWholeAmount, minorStep, toMajor } from '@/lib/format/money';
import { usePlural } from '@/lib/i18n/plural';

export interface FundingMilestone {
  /** Cumulative amount of the milestone, in minor units of the currency of the goal. */
  amountMinor: string;
  label?: string;
}

interface FundingProgressProps {
  /** Amount raised, in the currency of the goal (the equivalent frozen by the api). */
  raised: MoneyDto;
  goal: MoneyDto;
  /** 1 to 5 cumulative milestones, the last one being the goal or below it. */
  milestones?: readonly FundingMilestone[];
  /** Days left; null once the campaign has ended. */
  daysLeft: number | null;
  /** Accessible name of the bar ("Financement de Ferme solaire de Thiès"). */
  label: string;
  /** `compact` (side columns): a smaller amount and no list of milestones. */
  size?: 'full' | 'compact';
  className?: string;
}

function ratio(part: string, whole: string): number {
  const total = Number(BigInt(whole));
  return total === 0 ? 0 : Number(BigInt(part)) / total;
}

/**
 * State of a milestone: a circle with a check drawn in the colour of success once reached (H18),
 * an empty circle while to come. Decorative: the state is written next to it.
 */
function MilestoneIcon({
  reached,
  drawn,
  delay,
}: {
  reached: boolean;
  drawn: boolean;
  delay: number;
}) {
  if (!reached) {
    return (
      <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-muted">
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeDasharray="3 3"
        />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="drawn-stroke mt-0.5 size-5 shrink-0 text-success"
      data-drawn={drawn ? '' : undefined}
      style={{ '--draw-delay': `${delay}ms` } as CSSProperties}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        transform="rotate(-90 12 12)"
      />
      <path
        d="m8.5 12.5 2.5 2.5 4.5-5"
        pathLength={1}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Progress of a campaign: amount raised, goal, percentage and days left as text, a bar with the
 * markers of its milestones, then each milestone with its state. When it comes into view, the
 * bar fills, each reached milestone draws its check (H18), then the amount counts up (H17); with
 * less motion, the final state at once. Amounts on display, without zero decimals. A milestone
 * reached is not a promise of success (frontend handoff).
 */
export function FundingProgress({
  raised,
  goal,
  milestones = [],
  daysLeft,
  label,
  size = 'full',
  className,
}: FundingProgressProps) {
  const t = useTranslations('web.ui.funding');
  const plural = usePlural();
  const locale = useLocale();
  const reduced = useMotionPreference() === 'reduced';
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const percent = Math.floor(ratio(raised.amountMinor, goal.amountMinor) * 100);
  const fill = Math.min(1, ratio(raised.amountMinor, goal.amountMinor));
  // A whole amount counts in whole units: no decimals appear and vanish while it counts.
  const whole = isWholeAmount(raised);
  const step = whole ? 1 : minorStep(raised.currency);
  const format = useCallback(
    (value: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: raised.currency,
        minimumFractionDigits: whole ? 0 : undefined,
        maximumFractionDigits: whole ? 0 : minorStep(raised.currency) < 1 ? 2 : 0,
      }).format(value),
    [locale, raised.currency, whole],
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || reduced || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduced]);

  const reached = milestones.filter(
    (milestone) => BigInt(raised.amountMinor) >= BigInt(milestone.amountMinor),
  );
  const remaining =
    daysLeft === null ? t('ended') : t(`daysLeft.${plural(daysLeft)}`, { count: daysLeft });
  const summary = [
    t('raised', { amount: formatMoney(raised, locale), goal: formatMoney(goal, locale) }),
    t('percent', { percent }),
    remaining,
  ].join(', ');

  return (
    <div ref={ref} data-shown={shown ? '' : undefined} className={cn('grid gap-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p
          className={cn(
            'font-display font-extrabold tabular-nums',
            size === 'full' ? 'text-3xl' : 'text-xl',
          )}
        >
          <AnimatedNumber
            value={toMajor(raised)}
            format={format}
            step={step}
            delay={reached.length > 0 && size === 'full' ? DURATION_MS.fill : 0}
          />
        </p>
        <p className="text-sm text-muted">{t('goal', { goal: formatMoney(goal, locale) })}</p>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(percent, 100)}
        aria-valuetext={summary}
        className="relative h-2.5 rounded-full bg-track"
      >
        <span
          className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-accent transition-transform duration-(--duration-counter) ease-(--ease-enter)"
          style={{ transform: `scaleX(${shown ? fill : 0})` }}
        />
        {milestones.map((milestone, index) => {
          const position = Math.min(1, ratio(milestone.amountMinor, goal.amountMinor));
          const done = reached.includes(milestone);
          if (position >= 1) return null;
          return (
            <span
              key={milestone.amountMinor}
              aria-hidden
              data-reached={done && shown ? '' : undefined}
              className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted transition-colors duration-(--duration-page) data-[reached]:bg-on-accent"
              style={{ left: `${position * 100}%`, transitionDelay: `${index * 120}ms` }}
            />
          );
        })}
      </div>
      <p className="text-sm text-muted tabular-nums">
        {t('percent', { percent })}
        <span aria-hidden> · </span>
        {remaining}
      </p>
      {size === 'full' && milestones.length > 0 ? (
        <ol aria-label={t('milestones')} className="grid gap-3">
          {milestones.map((milestone, index) => {
            const done = reached.includes(milestone);
            return (
              <li
                key={milestone.amountMinor}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 text-sm"
              >
                <MilestoneIcon reached={done} drawn={shown} delay={index * 120} />
                <span className="grid min-w-0 gap-0.5">
                  <span className={cn('text-pretty', done ? 'font-medium' : 'text-muted')}>
                    {milestone.label ?? t('milestone', { index: index + 1 })}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium whitespace-nowrap',
                      done ? 'text-success' : 'text-muted',
                    )}
                  >
                    {done ? t('reached') : t('upcoming')}
                  </span>
                </span>
                <span className="whitespace-nowrap tabular-nums">
                  {formatMoney(
                    { amountMinor: milestone.amountMinor, currency: goal.currency },
                    locale,
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

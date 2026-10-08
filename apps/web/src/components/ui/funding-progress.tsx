'use client';

import type { MoneyDto } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedNumber, DURATION_MS, useMotionPreference } from '@/components/motion';
import { cn } from '@/lib/cn';
import { formatMoney, minorStep, toMajor } from '@/lib/format/money';
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
  className?: string;
}

function ratio(part: string, whole: string): number {
  const total = Number(BigInt(whole));
  return total === 0 ? 0 : Number(BigInt(part)) / total;
}

/**
 * Progress of a campaign: amount raised, goal, percentage and days left as text, a bar with the
 * markers of its milestones. When it comes into view, the bar fills, each reached milestone is
 * confirmed by a drawn stroke (H18), then the amount counts up (H17); with less motion, the final
 * state at once. A milestone reached is not a promise of success (frontend handoff).
 */
export function FundingProgress({
  raised,
  goal,
  milestones = [],
  daysLeft,
  label,
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
  const format = useCallback(
    (value: number) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: raised.currency,
        maximumFractionDigits: minorStep(raised.currency) < 1 ? 2 : 0,
      }).format(value),
    [locale, raised.currency],
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
  const summary = [
    t('raised', { amount: formatMoney(raised, locale), goal: formatMoney(goal, locale) }),
    t('percent', { percent }),
    daysLeft === null ? t('ended') : t(`daysLeft.${plural(daysLeft)}`, { count: daysLeft }),
  ].join(', ');

  return (
    <div ref={ref} data-shown={shown ? '' : undefined} className={cn('grid gap-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-display text-3xl font-extrabold tabular-nums">
          <AnimatedNumber
            value={toMajor(raised)}
            format={format}
            step={minorStep(raised.currency)}
            delay={reached.length > 0 ? DURATION_MS.fill : 0}
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
        {daysLeft === null ? t('ended') : t(`daysLeft.${plural(daysLeft)}`, { count: daysLeft })}
      </p>
      {milestones.length > 0 ? (
        <ol aria-label={t('milestones')} className="grid gap-1.5">
          {milestones.map((milestone, index) => {
            const done = reached.includes(milestone);
            return (
              <li
                key={milestone.amountMinor}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className={cn(done ? 'font-medium' : 'text-muted')}>
                  {milestone.label ?? t('milestone', { index: index + 1 })}
                  {done ? (
                    <span className="relative ml-2 inline-block text-xs font-medium text-success">
                      {t('reached')}
                      {/* H18: one stroke drawn under the word, decorative (copper touch). */}
                      <svg
                        aria-hidden
                        viewBox="0 0 100 8"
                        preserveAspectRatio="none"
                        className="funding-stroke absolute -bottom-1 left-0 h-1.5 w-full text-highlight"
                        data-drawn={shown ? '' : undefined}
                        style={{ animationDelay: `${index * 120}ms` }}
                      >
                        <path
                          d="M2 6 C 30 2, 70 2, 98 5"
                          pathLength={1}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums">
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

'use client';

import { Leaf } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface ImpactCriterion {
  label: string;
  score: number;
  max: number;
}

interface ImpactBadgeProps {
  /** Level of the api (`emerging`, `moderate`, `strong`) and its label (`reference.impactLevels`). */
  level: 'emerging' | 'moderate' | 'strong';
  levelLabel: string;
  /** 0 to 100. */
  score: number;
  /** The self-declared mention with its methodology (`reference.impactMentions.selfDeclared`). */
  mention: string;
  criteria: readonly ImpactCriterion[];
  className?: string;
}

const TONES = {
  emerging: 'bg-surface-sunken text-foreground',
  moderate: 'bg-accent-subtle text-on-accent-subtle',
  strong: 'bg-accent text-on-accent',
} as const;

/**
 * Self-declared impact score (§12): level and score in the badge, "self-declared" always
 * visible next to it, the detail per criterion in a Popover (keyboard and touch). Never the
 * vocabulary of a certification.
 */
export function ImpactBadge({
  level,
  levelLabel,
  score,
  mention,
  criteria,
  className,
}: ImpactBadgeProps) {
  const t = useTranslations('web.ui.impact');
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              TONES[level],
            )}
          >
            <Leaf aria-hidden className="size-3.5" />
            {/* The visible level and score are part of the name (WCAG 2.5.3, label in name). */}
            <span className="sr-only">{t('name')} </span>
            {levelLabel}
            <span aria-hidden>·</span>
            {score}
            <span className="sr-only"> {t('outOf')}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <p className="text-sm font-semibold">{t('title')}</p>
          <p className="mt-1 text-sm text-muted">{t('score', { score })}</p>
          <ul className="mt-3 grid gap-2.5">
            {criteria.map((criterion) => (
              <li key={criterion.label} className="grid gap-1">
                <span className="flex justify-between gap-3 text-sm">
                  <span>{criterion.label}</span>
                  <span className="text-muted tabular-nums">
                    {t('criterion', { score: criterion.score, max: criterion.max })}
                  </span>
                </span>
                <span aria-hidden className="h-1 overflow-hidden rounded-full bg-track">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${(criterion.score / criterion.max) * 100}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted">{mention}</p>
        </PopoverContent>
      </Popover>
      <span className="text-xs text-muted">{t('selfDeclared')}</span>
    </span>
  );
}

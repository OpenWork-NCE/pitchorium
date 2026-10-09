'use client';

import { Leaf } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { lazy, Suspense, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

const loadDetails = () => import('./impact-details');
/** The detail (Radix Popover) loads when the pointer or the focus reaches the badge (ADR 0094). */
const ImpactDetails = lazy(loadDetails);

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
  /**
   * `tinted` (default): a pale fill that never competes with the main action of the view;
   * `solid`: the level in the accent, for a heading.
   */
  variant?: 'tinted' | 'solid';
  /**
   * The short "self-declared" next to the badge, once. Off only where the full notice already
   * stands next to the score (the page of a project).
   */
  showMention?: boolean;
  className?: string;
}

const TONES = {
  tinted: {
    emerging: 'bg-surface-sunken text-foreground',
    moderate: 'bg-accent-subtle text-on-accent-subtle',
    strong: 'bg-accent-subtle text-on-accent-subtle ring-1 ring-on-accent-subtle/30 ring-inset',
  },
  solid: {
    emerging: 'bg-surface-sunken text-foreground',
    moderate: 'bg-accent-subtle text-on-accent-subtle',
    strong: 'bg-accent text-on-accent',
  },
} as const;

/**
 * Self-declared impact score (§12): level and score in the badge, "self-declared" said once next
 * to it, the detail per criterion and the full mention in a Popover (keyboard and touch), loaded
 * at its first use. Never the vocabulary of a certification.
 */
export function ImpactBadge({
  level,
  levelLabel,
  score,
  mention,
  criteria,
  variant = 'tinted',
  showMention = true,
  className,
}: ImpactBadgeProps) {
  const t = useTranslations('web.ui.impact');
  const [open, setOpen] = useState(false);
  const [opened, setOpened] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const preload = () => void loadDetails().catch(() => undefined);
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', className)}>
      <span className="relative inline-flex">
        <button
          ref={button}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onPointerEnter={preload}
          onFocus={preload}
          onClick={() => {
            setOpened(true);
            setOpen(!open);
          }}
          className={cn(
            'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            TONES[variant][level],
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
        {opened ? (
          <Suspense fallback={null}>
            <ImpactDetails
              open={open}
              onOpenChange={setOpen}
              returnFocus={button}
              id={id}
              score={score}
              mention={mention}
              criteria={criteria}
            />
          </Suspense>
        ) : null}
      </span>
      {showMention ? <span className="text-xs text-muted">{t('selfDeclared')}</span> : null}
    </span>
  );
}

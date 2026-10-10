'use client';

import { useTranslations } from 'next-intl';
import type { RefObject } from 'react';
import type { ImpactCriterion } from './impact-badge';
import { Link } from './link';
import { Popover, PopoverAnchor, PopoverContent } from './popover';

/**
 * The detail of an impact score, loaded at the first opening of its badge (ADR 0094): the score
 * per criterion and the full mention, in a Popover anchored on the badge; closed, the focus goes
 * back to the badge.
 */
export default function ImpactDetails({
  open,
  onOpenChange,
  returnFocus,
  id,
  score,
  mention,
  criteria,
  methodology,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
  id: string;
  score: number;
  mention: string;
  criteria: readonly ImpactCriterion[];
  methodology?: { href: string; label: string } | undefined;
}) {
  const t = useTranslations('web.ui.impact');
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <span aria-hidden className="pointer-events-none absolute inset-0" />
      </PopoverAnchor>
      <PopoverContent
        id={id}
        className="w-80"
        aria-label={t('title')}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
        // A click on the badge itself toggles it: not an outside click that closes then reopens.
        onInteractOutside={(event) => {
          if (returnFocus.current?.contains(event.target as Node)) event.preventDefault();
        }}
      >
        <p className="text-sm font-semibold">{t('title')}</p>
        <p className="mt-1 text-sm text-muted">{t('score', { score })}</p>
        {criteria.length > 0 ? (
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
        ) : null}
        {criteria.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t('detailOnPage')}</p>
        ) : null}
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted">{mention}</p>
        {methodology ? (
          <p className="mt-2 text-xs">
            <Link href={methodology.href} variant="standalone">
              {methodology.label}
            </Link>
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

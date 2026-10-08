'use client';

import { BadgeCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { Tooltip } from './tooltip';

interface VerifiedBadgeProps {
  /** What was verified and by whom ("Organisation vérifiée par Pitchorium"). */
  description?: string;
  /** `icon` next to a name; `label` with the word. */
  display?: 'icon' | 'label';
  className?: string;
}

/** Verification granted by Pitchorium (organisations, §13), never a self-declaration. */
export function VerifiedBadge({ description, display = 'icon', className }: VerifiedBadgeProps) {
  const t = useTranslations('web.ui.verified');
  const text = description ?? t('description');
  return (
    <Tooltip content={text}>
      <span
        // Focusable so that the explanation reaches the keyboard (WCAG 1.4.13).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        role="img"
        aria-label={text}
        className={cn(
          'inline-flex items-center gap-1 rounded-full text-accent outline-none focus-visible:outline-2 focus-visible:outline-focus',
          className,
        )}
      >
        <BadgeCheck aria-hidden className="size-5" />
        {display === 'label' ? (
          <span aria-hidden className="text-xs font-medium">
            {t('label')}
          </span>
        ) : null}
      </span>
    </Tooltip>
  );
}

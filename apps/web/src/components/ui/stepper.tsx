'use client';

import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface StepperProps {
  steps: readonly { id: string; label: ReactNode }[];
  /** Index of the current step, from 0. */
  current: number;
  /** Accessible name of the list ("Création du projet"). */
  label: string;
  className?: string;
}

/**
 * Steps of a flow done in several screens (onboarding, project creation): done, current
 * (`aria-current=step`), to come. The step number and its state are said, not only drawn.
 */
export function Stepper({ steps, current, label, className }: StepperProps) {
  const t = useTranslations('web.ui.stepper');
  return (
    <nav aria-label={label} className={className}>
      <p className="mb-3 text-sm text-muted sm:sr-only">
        {t('position', { current: current + 1, total: steps.length })}
      </p>
      <ol className="flex items-center gap-2">
        {steps.map((step, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'upcoming';
          return (
            <li
              key={step.id}
              aria-current={state === 'current' ? 'step' : undefined}
              className="flex flex-1 items-center gap-2 last:flex-none"
            >
              <span
                data-state={state}
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums',
                  'data-[state=done]:border-accent data-[state=done]:bg-accent data-[state=done]:text-on-accent',
                  'data-[state=current]:border-accent data-[state=current]:text-accent',
                  'data-[state=upcoming]:border-border-strong data-[state=upcoming]:text-muted',
                )}
              >
                {state === 'done' ? <Check aria-hidden className="size-4" /> : index + 1}
              </span>
              <span
                className={cn(
                  'sr-only text-sm sm:not-sr-only',
                  state === 'upcoming' ? 'text-muted' : 'font-medium',
                )}
              >
                {step.label}
                <span className="sr-only"> ({t(state)})</span>
              </span>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn('h-px flex-1', index < current ? 'bg-accent' : 'bg-border')}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

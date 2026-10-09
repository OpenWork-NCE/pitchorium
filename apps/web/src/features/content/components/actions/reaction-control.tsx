'use client';

import type { ReactionSummary, ReactionType } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button, notify } from '@/components/ui';
import { IconSwap } from '@/components/motion';
import { useWithPrerequisites } from '@/features/access';
import { cn } from '@/lib/cn';
import { REACTIONS, toggledReaction, withReaction } from '../../lib/reactions';
import { REACTION_ICONS } from '../reaction-summary';
import { ReactionMenu } from './reaction-menu';
import { useProblemText } from './use-problem-text';

/** Hover intent before the picker opens on a pointer, and the press of a touch. */
const HOVER_INTENT_MS = 450;
const LONG_PRESS_MS = 450;
const LEAVE_GRACE_MS = 250;

/**
 * Reacting to a publication (§10.3): a click gives « J'aime » or takes back the reaction given; the
 * four reactions open on hover after a moment (pointer), on a long press (touch) and from the menu
 * of the arrow (keyboard). The summary changes at once (ADR 0112) and comes back with the reason
 * if the api refuses; made offline, the reaction waits and survives the closing of the tab
 * (ADR 0102) for a publication; refused for a missing element, its form opens and the reaction
 * is sent again. The same control serves the comments.
 */
export function ReactionControl({
  summary,
  onChange,
  send,
  size = 'sm',
}: {
  summary: ReactionSummary;
  /** The summary to show: at once, then as the api answers, or back on a refusal. */
  onChange: (summary: ReactionSummary) => void;
  /** Sends the reaction (null: takes it back); resolves with the summary of the api. */
  send: (next: ReactionType | null) => Promise<ReactionSummary>;
  size?: 'sm' | 'xs';
}) {
  const t = useTranslations('web.content.actions');
  const names = useTranslations('reference.reactionTypes');
  const withPrerequisites = useWithPrerequisites();
  const problem = useProblemText();
  const [picker, setPicker] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pressed = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  const current = summary.viewerReaction;

  function react(next: ReactionType | null) {
    setPicker(false);
    const before = summary;
    onChange(withReaction(summary, next));
    withPrerequisites(() => send(next)).then(
      (answer) => onChange(answer),
      (error: unknown) => {
        onChange(before);
        notify.error(problem(error));
      },
    );
  }

  const arm = (delay: number, after?: () => void) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPicker(true);
      after?.();
    }, delay);
  };

  function pointerDown(event: ReactPointerEvent) {
    if (event.pointerType !== 'touch') return;
    pressed.current = false;
    arm(LONG_PRESS_MS, () => {
      pressed.current = true;
    });
  }

  return (
    <div
      className="relative flex items-center"
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setPicker(false), LEAVE_GRACE_MS);
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse' && picker) clearTimeout(timer.current);
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={current !== null}
        className={cn('select-none', current && 'text-link', size === 'xs' && 'h-8 px-2 text-xs')}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') arm(HOVER_INTENT_MS);
        }}
        onPointerDown={pointerDown}
        onPointerUp={() => {
          if (!pressed.current) clearTimeout(timer.current);
        }}
        onContextMenu={(event) => {
          // A long press opens the reactions, not the menu of the browser.
          if (pressed.current || picker) event.preventDefault();
        }}
        onClick={(event) => {
          if (pressed.current) {
            pressed.current = false;
            event.preventDefault();
            return;
          }
          clearTimeout(timer.current);
          react(toggledReaction(current));
        }}
      >
        <IconSwap
          state={current ?? 'like'}
          icons={
            Object.fromEntries(
              REACTIONS.map((type) => {
                const Icon = REACTION_ICONS[type];
                return [type, <Icon key={type} aria-hidden />];
              }),
            ) as Record<ReactionType, ReactNode>
          }
        />
        {names(current ?? 'like')}
      </Button>
      <ReactionMenu current={current} onChoose={react} />
      {picker ? (
        <div
          role="toolbar"
          aria-label={t('reactionsMenu')}
          className="absolute bottom-full left-0 z-(--z-overlay) mb-2 flex gap-1 rounded-full border border-border bg-surface-elevated p-1 shadow-md"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setPicker(false);
          }}
        >
          {REACTIONS.map((type, index) => {
            const Icon = REACTION_ICONS[type];
            return (
              <button
                key={type}
                type="button"
                aria-pressed={current === type}
                aria-label={names(type)}
                title={names(type)}
                onClick={() => react(current === type ? null : type)}
                style={{ animationDelay: `${index * 40}ms` }}
                className={cn(
                  'reaction-pop flex size-11 items-center justify-center rounded-full outline-none hover:bg-accent-subtle focus-visible:outline-2 focus-visible:outline-focus',
                  current === type && 'bg-accent-subtle text-on-accent-subtle',
                )}
              >
                <Icon aria-hidden className="size-6" />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

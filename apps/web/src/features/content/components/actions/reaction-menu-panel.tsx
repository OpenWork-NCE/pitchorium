'use client';

import type { ReactionType } from '@pitchorium/contracts';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  IconButton,
} from '@/components/ui';
import { REACTIONS } from '../../lib/reactions';
import { REACTION_ICONS } from '../reaction-summary';

export interface ReactionMenuPanelProps {
  current: ReactionType | null;
  onChoose: (next: ReactionType | null) => void;
  defaultOpen?: boolean;
  /** The trigger takes the focus the plain button had. */
  focusTrigger?: boolean;
}

/** The menu of the four reactions (arrows, Enter), the reaction given checked. */
export function ReactionMenuPanel({
  current,
  onChoose,
  defaultOpen = false,
  focusTrigger = false,
}: ReactionMenuPanelProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusTrigger) trigger.current?.focus();
  }, [focusTrigger]);
  const t = useTranslations('web.content.actions');
  const names = useTranslations('reference.reactionTypes');
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger asChild>
        <IconButton ref={trigger} label={t('chooseReaction')} icon={<ChevronDown />} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" aria-label={t('reactionsMenu')}>
        <DropdownMenuRadioGroup
          value={current ?? ''}
          onValueChange={(value) => onChoose(value === current ? null : (value as ReactionType))}
        >
          {REACTIONS.map((type) => {
            const Icon = REACTION_ICONS[type];
            return (
              <DropdownMenuRadioItem key={type} value={type}>
                <Icon aria-hidden />
                {names(type)}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

'use client';

import type { ReactionType } from '@pitchorium/contracts';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentType, useState } from 'react';
import { IconButton } from '@/components/ui';
import type { ReactionMenuPanelProps } from './reaction-menu-panel';

const loadPanel = () => import('./reaction-menu-panel');

/**
 * The four reactions from the keyboard: an arrow button whose menu (Radix DropdownMenu) loads
 * when the pointer or the focus comes, or at the press, then opens.
 */
export function ReactionMenu({
  current,
  onChoose,
}: {
  current: ReactionType | null;
  onChoose: (next: ReactionType | null) => void;
}) {
  const t = useTranslations('web.content.actions');
  const [Panel, setPanel] = useState<ComponentType<ReactionMenuPanelProps> | null>(null);
  const [open, setOpen] = useState(false);
  // The plain button had the focus when the panel took its place: the panel takes it back.
  const [focused, setFocused] = useState(false);
  const load = () =>
    loadPanel().then(
      (module) => setPanel(() => module.ReactionMenuPanel),
      () => undefined,
    );
  if (Panel)
    return (
      <Panel current={current} onChoose={onChoose} defaultOpen={open} focusTrigger={focused} />
    );
  return (
    <IconButton
      label={t('chooseReaction')}
      icon={<ChevronDown />}
      size="sm"
      aria-haspopup="menu"
      aria-expanded={false}
      onPointerEnter={() => void load()}
      onFocus={() => {
        setFocused(true);
        void load();
      }}
      onBlur={() => {
        setFocused(false);
      }}
      // At the press already: the panel may take the place of the button before the release.
      onPointerDown={() => {
        setOpen(true);
        void load();
      }}
      onClick={() => {
        setOpen(true);
        void load();
      }}
    />
  );
}

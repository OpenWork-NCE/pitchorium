'use client';

import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentType, useState } from 'react';
import { IconButton } from '@/components/ui';
import type { MessageActionsProps } from './message-actions-panel';

/** The menu (Radix DropdownMenu and its dialogs) loads with its first use. */
const loadPanel = () => import('./message-actions-panel');

/**
 * « Actions du message » of a message of the reader: a plain button first, the panel loaded when
 * the pointer or the focus comes to it, or at the press (ADR 0094, as the menu of a post).
 */
export function MessageActions(props: MessageActionsProps) {
  const t = useTranslations('web.messaging');
  const [Panel, setPanel] = useState<ComponentType<MessageActionsProps> | null>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const load = () =>
    loadPanel().then(
      (module) => setPanel(() => module.MessageActionsPanel),
      () => undefined,
    );
  if (Panel) return <Panel {...props} defaultOpen={open} focusTrigger={focused} />;
  return (
    <IconButton
      label={t('messageActions')}
      icon={<MoreHorizontal />}
      size="sm"
      aria-haspopup="menu"
      aria-expanded={false}
      onPointerEnter={() => void load()}
      onFocus={() => {
        setFocused(true);
        void load();
      }}
      onBlur={() => setFocused(false)}
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

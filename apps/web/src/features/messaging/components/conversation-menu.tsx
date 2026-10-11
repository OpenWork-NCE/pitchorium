'use client';

import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentType, useState } from 'react';
import { IconButton } from '@/components/ui';
import type { ConversationMenuProps } from './conversation-menu-panel';

const loadPanel = () => import('./conversation-menu-panel');

/** « Actions de la conversation »: a plain button, the menu loaded at its first use (ADR 0094). */
export function ConversationMenu(props: ConversationMenuProps) {
  const t = useTranslations('web.messaging.thread');
  const [Panel, setPanel] = useState<ComponentType<ConversationMenuProps> | null>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const load = () =>
    loadPanel().then(
      (module) => setPanel(() => module.ConversationMenuPanel),
      () => undefined,
    );
  if (Panel) return <Panel {...props} defaultOpen={open} focusTrigger={focused} />;
  return (
    <IconButton
      label={t('actions')}
      icon={<MoreHorizontal />}
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

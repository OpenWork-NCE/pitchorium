'use client';

import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentType, useState } from 'react';
import { IconButton } from '@/components/ui';
import type { PostMenuProps } from './post-menu-panel';

/** The menu (Radix DropdownMenu, its positioning and its dialogs) loads with its first use. */
const loadPanel = () => import('./post-menu-panel');

/**
 * « Plus d'actions » of a publication: a plain button first, the panel loaded when the pointer
 * or the focus comes to it, or at the press, then opened (ADR 0094: a feed of dozens of
 * publications carries no menu in its first load).
 */
export function PostMenu(props: PostMenuProps) {
  const t = useTranslations('web.content.actions');
  const [Panel, setPanel] = useState<ComponentType<PostMenuProps> | null>(null);
  const [open, setOpen] = useState(false);
  // The plain button had the focus when the panel took its place: the panel takes it back.
  const [focused, setFocused] = useState(false);
  const load = () =>
    loadPanel().then(
      (module) => setPanel(() => module.PostMenuPanel),
      () => undefined,
    );
  if (Panel) return <Panel {...props} defaultOpen={open} focusTrigger={focused} />;
  return (
    <IconButton
      label={t('more')}
      icon={<MoreHorizontal />}
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
      // At the press already: the panel may take the place of the button before the release,
      // and the click would then be lost (seen in Firefox).
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

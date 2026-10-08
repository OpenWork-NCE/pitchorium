'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { type CommandAction, IconButton, Kbd, useIsApple, useShortcut } from '@/components/ui';
import { preloadWhenIdle } from '@/lib/preload';
import { displayKeys } from '@/lib/shortcuts/keys';
import { useRecentSearches } from './recent-searches';

/** The palette and cmdk stay out of the first load; they arrive when the page is idle (ADR 0094). */
const loadPalette = () => import('@/components/ui/command-palette');
const CommandPalette = dynamic(() => loadPalette().then((module) => module.CommandPalette), {
  ssr: false,
});

interface GlobalSearchProps {
  /** Quick actions of the shell (publish, create a project, go to a section). */
  actions: readonly CommandAction[];
  /** `field`: the search field of a wide header; `icon`: a button on a narrow one. */
  display: 'field' | 'icon';
}

/**
 * Global search of the member space (§6.1, always visible): a field in the header, opened by
 * Ctrl K or Cmd K, that runs the command palette. The results of the search arrive with the
 * search pages (PROMPT FRONT 7); recent searches and quick actions work today.
 */
export function GlobalSearch({ actions, display }: GlobalSearchProps) {
  const t = useTranslations('web.search');
  const apple = useIsApple();
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const { recent, remember, clear } = useRecentSearches();
  useEffect(() => preloadWhenIdle(loadPalette), []);
  const openPalette = () => {
    setUsed(true);
    setOpen(true);
  };
  useShortcut({ keys: 'mod+k', label: t('shortcut'), group: t('group'), run: openPalette });

  const trigger =
    display === 'field' ? (
      <button
        type="button"
        onClick={openPalette}
        aria-haspopup="dialog"
        aria-keyshortcuts={apple ? 'Meta+K' : 'Control+K'}
        className="flex h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface-sunken px-4 text-left text-sm text-muted outline-none hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Search aria-hidden className="size-4 shrink-0" />
        <span className="flex-1 truncate">{t('placeholder')}</span>
        <span aria-hidden className="flex gap-1 max-lg:hidden">
          {displayKeys('mod+k', apple).map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </span>
      </button>
    ) : (
      <IconButton
        label={t('placeholder')}
        icon={<Search />}
        aria-haspopup="dialog"
        aria-keyshortcuts={apple ? 'Meta+K' : 'Control+K'}
        onClick={openPalette}
      />
    );

  return (
    <>
      {trigger}
      {used ? (
        <CommandPalette
          open={open}
          onOpenChange={setOpen}
          actions={actions}
          recent={recent}
          onSearch={remember}
          onClearRecent={clear}
        />
      ) : null}
    </>
  );
}

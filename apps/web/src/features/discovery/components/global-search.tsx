'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentType, useEffect, useState } from 'react';
import { IconButton, Kbd, useIsApple, useShortcut } from '@/components/ui';
import { preloadWhenIdle } from '@/lib/preload';
import { displayKeys } from '@/lib/shortcuts/keys';

export interface PaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface GlobalSearchProps {
  /**
   * The palette the shell composes (search and its quick actions), a component loaded on demand:
   * mounted at the first opening, its code fetched when the page is idle (ADR 0094).
   */
  palette: ComponentType<PaletteProps>;
  /** Fetches the code of the palette ahead of its first opening. */
  preload: () => Promise<unknown>;
  /** `field`: the search field of a wide header; `icon`: a button on a narrow one. */
  display: 'field' | 'icon';
}

/**
 * Global search of the member space (§6.1, always visible): a field in the header, opened by
 * Ctrl K or Cmd K, that runs the command palette. Only this trigger is in the first load.
 */
export function GlobalSearch({ palette: Palette, preload, display }: GlobalSearchProps) {
  const t = useTranslations('web.search');
  const apple = useIsApple();
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  useEffect(() => preloadWhenIdle(preload), [preload]);
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
      {used ? <Palette open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}

'use client';

import { Command } from 'cmdk';
import { Clock, CornerDownLeft, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog as Primitive } from 'radix-ui';
import { type ReactNode, useState } from 'react';
import { Kbd } from './kbd';
import { backdrop } from './overlay-classes';

export interface CommandAction {
  id: string;
  label: string;
  /** A lucide icon element. */
  icon?: ReactNode;
  /** Keys of its own shortcut, shown at the end of the line. */
  keys?: readonly string[];
  /** Words that also find it ("paramètres" for "Préférences"). */
  keywords?: readonly string[];
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quick actions of the context (publish, create a project, switch the theme). */
  actions: readonly CommandAction[];
  /** Last searches, most recent first. */
  recent: readonly string[];
  /** A search typed and confirmed: recorded, then run (search results arrive with the search). */
  onSearch: (query: string) => void;
  onClearRecent: () => void;
}

/**
 * Shell of the global search, opened by Ctrl K or Cmd K (cmdk in a Radix Dialog): quick actions
 * and recent searches; the results of the search itself come with the search pages. Arrows move,
 * Enter runs, Escape closes and gives the focus back.
 */
export function CommandPalette({
  open,
  onOpenChange,
  actions,
  recent,
  onSearch,
  onClearRecent,
}: CommandPaletteProps) {
  const t = useTranslations('web.ui.command');
  const [query, setQuery] = useState('');
  const trimmed = query.trim();

  function run(action: () => void) {
    action();
    onOpenChange(false);
    setQuery('');
  }

  return (
    <Primitive.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery('');
      }}
    >
      <Primitive.Portal>
        <Primitive.Overlay className={backdrop} />
        <Primitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-3 top-[12vh] z-(--z-modal) mx-auto max-w-xl overflow-hidden rounded-2xl border border-border bg-surface-elevated text-foreground shadow-lg outline-none data-[state=open]:animate-[menu-in_var(--duration-page)_var(--ease-enter)]"
        >
          <Primitive.Title className="sr-only">{t('title')}</Primitive.Title>
          <Command loop label={t('title')}>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search aria-hidden className="size-5 shrink-0 text-muted" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder={t('placeholder')}
                className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted"
              />
              <Kbd className="max-sm:hidden">{t('escape')}</Kbd>
            </div>
            <Command.List className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted">
                {t('empty')}
              </Command.Empty>
              {trimmed ? (
                <Command.Group heading={t('searchGroup')} className={GROUP}>
                  <Command.Item
                    value={`search ${trimmed}`}
                    onSelect={() => run(() => onSearch(trimmed))}
                    className={ITEM}
                  >
                    <Search aria-hidden className="size-4 text-muted" />
                    <span className="flex-1 truncate">{t('searchFor', { query: trimmed })}</span>
                    <CornerDownLeft aria-hidden className="size-4 text-muted" />
                  </Command.Item>
                  <p className="px-3 pt-1 pb-2 text-xs text-muted">{t('resultsLater')}</p>
                </Command.Group>
              ) : null}
              {actions.length > 0 ? (
                <Command.Group heading={t('actions')} className={GROUP}>
                  {actions.map((action) => (
                    <Command.Item
                      key={action.id}
                      value={`${action.label} ${action.keywords?.join(' ') ?? ''}`}
                      onSelect={() => run(action.onSelect)}
                      className={ITEM}
                    >
                      <span aria-hidden className="text-muted [&_svg]:size-4">
                        {action.icon}
                      </span>
                      <span className="flex-1">{action.label}</span>
                      {action.keys ? (
                        <span className="flex gap-1 max-sm:hidden">
                          {action.keys.map((key) => (
                            <Kbd key={key}>{key}</Kbd>
                          ))}
                        </span>
                      ) : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {!trimmed && recent.length > 0 ? (
                <Command.Group heading={t('recent')} className={GROUP}>
                  {recent.map((entry) => (
                    <Command.Item
                      key={entry}
                      value={`recent ${entry}`}
                      onSelect={() => run(() => onSearch(entry))}
                      className={ITEM}
                    >
                      <Clock aria-hidden className="size-4 text-muted" />
                      <span className="flex-1 truncate">{entry}</span>
                    </Command.Item>
                  ))}
                  <Command.Item
                    value="clear recent searches"
                    onSelect={onClearRecent}
                    className={`${ITEM} text-muted`}
                  >
                    <span className="flex-1 pl-7 text-sm">{t('clearRecent')}</span>
                  </Command.Item>
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}

const GROUP =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted';

const ITEM =
  'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm outline-none select-none data-[selected=true]:bg-surface-sunken';

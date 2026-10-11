'use client';

import { Command } from 'cmdk';
import { Clock, CornerDownLeft, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog as Primitive } from 'radix-ui';
import { type ReactNode, useState } from 'react';
import { fold, highlightParts } from '@/lib/search/highlight';
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

/** A result of the search, under the heading of its kind. */
export interface CommandResult {
  id: string;
  title: string;
  subtitle?: string | null;
  /** A lucide icon element, or an avatar. */
  icon?: ReactNode;
  onSelect: () => void;
}

export interface CommandResultGroup {
  id: string;
  heading: string;
  items: readonly CommandResult[];
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quick actions of the context (publish, create a project, switch the theme). */
  actions: readonly CommandAction[];
  /** Last searches, most recent first. */
  recent: readonly string[];
  /** A search typed and confirmed (Enter on « Rechercher »), or a recent one chosen again. */
  onSearch: (query: string) => void;
  onClearRecent: () => void;
  /** The text typed, for a search run by the caller (results). */
  onQueryChange?: (query: string) => void;
  /**
   * Results found by the caller for the text typed, grouped by kind: the caller searches (the api
   * tolerates typos), the palette does not filter them again.
   */
  results?: readonly CommandResultGroup[];
  /** Results are on their way: the list keeps its height and says it. */
  busy?: boolean;
}

/** Whether a quick action answers the text typed: its label or a keyword, accents ignored. */
function matches(action: CommandAction, query: string): boolean {
  const folded = fold(query);
  return [action.label, ...(action.keywords ?? [])].some((text) => fold(text).includes(folded));
}

/** The words of a title that match the text typed, in bold. */
function Highlighted({ text, query }: { text: string; query: string }) {
  return highlightParts(text, query).map((part, index) =>
    part.match ? (
      <mark key={index} className="bg-transparent font-semibold text-foreground">
        {part.text}
      </mark>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  );
}

/**
 * The global search, opened by Ctrl K or Cmd K (cmdk in a Radix Dialog): the results the caller
 * found for the text typed, grouped by kind with their matching words in bold, then « Rechercher »
 * for the full page, the quick actions, and the recent searches. Arrows move, Enter runs, Escape
 * closes and gives the focus back. The list keeps its height while results arrive (no jump).
 */
export function CommandPalette({
  open,
  onOpenChange,
  actions,
  recent,
  onSearch,
  onClearRecent,
  onQueryChange,
  results,
  busy = false,
}: CommandPaletteProps) {
  const t = useTranslations('web.ui.command');
  const [query, setQuery] = useState('');
  const trimmed = query.trim();
  const searching = results !== undefined;
  const shownActions = searching && trimmed ? actions.filter((a) => matches(a, trimmed)) : actions;
  // The line selected: the first result once results arrive (Enter opens it), else the first
  // line; then the arrows move it.
  const firstAction = shownActions[0];
  const first = searching
    ? (results.find((group) => group.items.length > 0)?.items[0]?.id ??
      (trimmed
        ? `search ${trimmed}`
        : firstAction
          ? `${firstAction.label} ${firstAction.keywords?.join(' ') ?? ''}`
          : ''))
    : undefined;
  const [selected, setSelected] = useState('');
  const [seen, setSeen] = useState<string | undefined>(undefined);
  if (first !== seen) {
    // New lines at the top: the selection follows them (state adjusted while rendering).
    setSeen(first);
    if (first !== undefined) setSelected(first);
  }

  function change(next: string) {
    setQuery(next);
    onQueryChange?.(next);
  }

  function run(action: () => void) {
    action();
    onOpenChange(false);
    change('');
  }

  return (
    <Primitive.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) change('');
      }}
    >
      <Primitive.Portal>
        <Primitive.Overlay className={backdrop} />
        <Primitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-3 top-[12vh] z-(--z-modal) mx-auto max-w-xl overflow-hidden rounded-2xl border border-border bg-surface-elevated text-foreground shadow-lg outline-none data-[state=open]:animate-[menu-in_var(--duration-page)_var(--ease-enter)]"
        >
          <Primitive.Title className="sr-only">{t('title')}</Primitive.Title>
          <Command
            loop
            label={t('title')}
            shouldFilter={!searching}
            {...(searching ? { value: selected, onValueChange: setSelected } : {})}
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search aria-hidden className="size-5 shrink-0 text-muted" />
              <Command.Input
                value={query}
                onValueChange={change}
                placeholder={t('placeholder')}
                className="h-14 w-full bg-transparent text-base outline-none placeholder:text-muted"
              />
              <Kbd className="max-sm:hidden">{t('escape')}</Kbd>
            </div>
            <Command.List
              label={t('list')}
              aria-busy={busy}
              className="h-[min(60vh,26rem)] overflow-y-auto overscroll-contain p-2"
            >
              {searching ? null : (
                <Command.Empty className="px-3 py-8 text-center text-sm text-muted">
                  {t('empty')}
                </Command.Empty>
              )}
              {searching && trimmed
                ? results.map((group) => (
                    <Command.Group key={group.id} heading={group.heading} className={GROUP}>
                      {group.items.map((item) => (
                        <Command.Item
                          key={item.id}
                          value={item.id}
                          onSelect={() => run(item.onSelect)}
                          className={ITEM}
                        >
                          <span aria-hidden className="shrink-0 text-muted [&_svg]:size-4">
                            {item.icon}
                          </span>
                          <span className="grid min-w-0 flex-1">
                            <span className="truncate">
                              <Highlighted text={item.title} query={trimmed} />
                            </span>
                            {item.subtitle ? (
                              <span className="truncate text-xs text-muted">{item.subtitle}</span>
                            ) : null}
                          </span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ))
                : null}
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
                  {searching && !busy && results.length === 0 ? (
                    <p className="px-3 pt-1 pb-2 text-xs text-muted">{t('noResults')}</p>
                  ) : null}
                </Command.Group>
              ) : null}
              {shownActions.length > 0 ? (
                <Command.Group heading={t('actions')} className={GROUP}>
                  {shownActions.map((action) => (
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

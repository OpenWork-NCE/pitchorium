'use client';

import {
  discoveryControllerAutocomplete,
  discoveryControllerPublicAutocomplete,
} from '@pitchorium/api-client';
import { DISCOVERY_KINDS, type DiscoveryKind } from '../lib/kinds';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Briefcase, Building2, CalendarDays, FolderKanban, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createElement, useDeferredValue, useEffect, useState } from 'react';
import { type CommandAction, CommandPalette, type CommandResultGroup } from '@/components/ui';
import * as routes from '@/config/paths';
import { useRouter } from '@/i18n/navigation';
import { resultHref } from '../lib/hrefs';
import { useRecentSearches } from '@/lib/search/recent-searches';

const KIND_ICONS = {
  person: UserRound,
  organization: Building2,
  project: FolderKanban,
  event: CalendarDays,
  mission: Briefcase,
} as const;

/** Delay after the last key before asking the api: one request per pause, not per letter. */
const DEBOUNCE_MS = 150;

interface SearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quick actions of the shell, built when the palette opens. */
  actions: readonly CommandAction[];
  /** A member searches what members see; a visitor, what is public (ADR 0066). */
  signedIn: boolean;
}

/**
 * The global search (§10.6, FRONT 7): the autocompletion of the api (people, organizations,
 * projects, events, missions, typos tolerated) grouped by kind, the matching words in bold, then
 * the full results page, the quick actions and the recent searches of this device. Loaded with
 * the first opening (ADR 0094).
 */
export function SearchPalette({ open, onOpenChange, actions, signedIn }: SearchPaletteProps) {
  const t = useTranslations('web.search');
  const router = useRouter();
  const { recent, remember, clear } = useRecentSearches();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);
  const q = useDeferredValue(debounced);
  const autocomplete = useQuery({
    queryKey: ['discovery', 'autocomplete', signedIn, q],
    queryFn: ({ signal }) =>
      signedIn
        ? discoveryControllerAutocomplete({ q, limit: 10 }, { signal })
        : discoveryControllerPublicAutocomplete({ q, limit: 10 }, { signal }),
    enabled: q.length > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  function search(text: string) {
    remember(text);
    router.push(`${routes.search}?q=${encodeURIComponent(text)}`);
  }

  const items = q ? (autocomplete.data?.items ?? []) : [];
  const results: CommandResultGroup[] = DISCOVERY_KINDS.flatMap((kind: DiscoveryKind) => {
    const found = items.filter((item) => item.kind === kind);
    if (found.length === 0) return [];
    return [
      {
        id: kind,
        heading: t(`kinds.${kind}`),
        items: found.map((item) => ({
          id: `${kind}:${item.key}`,
          title: item.title,
          subtitle: item.subtitle,
          icon: createElement(KIND_ICONS[kind]),
          onSelect: () => {
            remember(query.trim());
            router.push(resultHref(kind, item.key));
          },
        })),
      },
    ];
  });

  return (
    <CommandPalette
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery('');
      }}
      actions={actions}
      recent={recent}
      onSearch={search}
      onClearRecent={clear}
      onQueryChange={setQuery}
      results={results}
      busy={query.trim() !== q || autocomplete.isFetching}
    />
  );
}

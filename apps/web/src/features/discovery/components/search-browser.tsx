'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { type ReactNode, useState, useTransition } from 'react';
import { UrlStateProvider } from '@/components/layout/url-state';
import {
  Button,
  DeferredSelect,
  Field,
  Input,
  Loading,
  Skeleton,
  Tabs,
  TabsPanel,
} from '@/components/ui';
import { useRecentSearches } from '@/lib/search/recent-searches';
import {
  EVENT_FORMATS,
  MISSION_DIRECTIONS,
  MISSION_KINDS,
  MISSION_MODES,
  PROJECT_STATUSES,
} from '../lib/kinds';
import {
  SEARCH_IMPACTS,
  SEARCH_TABS,
  SEARCH_WHEN,
  type SearchTab,
  TAB_FILTERS,
} from '../lib/search-query';

interface Option {
  value: string;
  label: string;
}

const ALL = 'all';

const parsers = {
  q: parseAsString.withDefault(''),
  type: parseAsStringLiteral(SEARCH_TABS).withDefault('all'),
  country: parseAsString,
  sector: parseAsString,
  language: parseAsString,
  status: parseAsStringLiteral(PROJECT_STATUSES),
  impact: parseAsStringLiteral(SEARCH_IMPACTS),
  format: parseAsStringLiteral(EVENT_FORMATS),
  when: parseAsStringLiteral(SEARCH_WHEN),
  direction: parseAsStringLiteral(MISSION_DIRECTIONS),
  kind: parseAsStringLiteral(MISSION_KINDS),
  mode: parseAsStringLiteral(MISSION_MODES),
};

/** Filters of one kind, cleared when the tab changes: they would restrict the api to it. */
const KIND_FILTERS = ['status', 'impact', 'format', 'when', 'direction', 'kind', 'mode'] as const;

/** A change renders the page again on the server: the address is the search, shareable. */
const OPTIONS = { shallow: false, history: 'push' } as const;

interface SearchBrowserProps {
  countries: readonly Option[];
  sectors: readonly Option[];
  languages: readonly Option[];
  /** The impact filter, only once a methodology is published (§12). */
  impactAvailable: boolean;
  children: ReactNode;
}

/**
 * The query, the tabs by kind and the filters of the results page (§10.6), all in the address
 * (nuqs): each change asks the server for the results again, the grid giving way to its
 * skeletons meanwhile. The results are the children.
 */
function Browser({ countries, sectors, languages, impactAvailable, children }: SearchBrowserProps) {
  const t = useTranslations('web.search.page');
  const kinds = useTranslations('web.search.kinds');
  const reference = useTranslations('reference');
  const { remember } = useRecentSearches();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useQueryStates(parsers, { ...OPTIONS, startTransition });
  const [text, setText] = useState(state.q);
  const filters = TAB_FILTERS[state.type];

  const select = (name: keyof typeof parsers, label: string, options: readonly Option[]) => (
    <Field key={name} label={label}>
      <DeferredSelect
        value={state[name] ?? ALL}
        onValueChange={(value) => void setState({ [name]: value === ALL ? null : value })}
        options={[{ value: ALL, label: t('any') }, ...options]}
      />
    </Field>
  );
  const values = (prefix: string, list: readonly string[]) =>
    list.map((value) => ({ value, label: reference(`${prefix}.${value}` as never) }));

  const controls: Record<string, ReactNode> = {
    country: select('country', t('country'), countries),
    sector: select('sector', t('sector'), sectors),
    language: select('language', t('language'), languages),
    status: select('status', t('status'), values('projectStatuses', PROJECT_STATUSES)),
    impact: impactAvailable
      ? select(
          'impact',
          t('impact'),
          SEARCH_IMPACTS.map((impact) => ({
            value: impact,
            label: t('impactAtLeast', { score: impact }),
          })),
        )
      : null,
    format: select('format', t('format'), values('eventFormats', EVENT_FORMATS)),
    when: (
      <Field key="when" label={t('when')}>
        <DeferredSelect
          value={state.when ?? 'upcoming'}
          onValueChange={(value) => void setState({ when: value === 'upcoming' ? null : 'all' })}
          options={SEARCH_WHEN.map((when) => ({ value: when, label: t(`whenOptions.${when}`) }))}
        />
      </Field>
    ),
    direction: select('direction', t('direction'), values('missionDirections', MISSION_DIRECTIONS)),
    kind: select('kind', t('missionKind'), values('timeEntryKinds', MISSION_KINDS)),
    mode: select('mode', t('mode'), values('missionModes', MISSION_MODES)),
  };

  function changeTab(type: SearchTab) {
    const cleared = Object.fromEntries(KIND_FILTERS.map((key) => [key, null]));
    void setState({ ...cleared, type: type === 'all' ? null : type });
  }

  return (
    <div className="grid gap-6">
      <form
        role="search"
        aria-label={t('formLabel')}
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const q = text.trim();
          if (q) remember(q);
          void setState({ q: q || null });
        }}
      >
        <Field label={t('query')} className="flex-1" hideLabel>
          <Input
            type="search"
            name="q"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('placeholder')}
            enterKeyHint="search"
            maxLength={100}
          />
        </Field>
        <Button type="submit">
          <Search aria-hidden />
          {t('submit')}
        </Button>
      </form>
      <Tabs
        value={state.type}
        onValueChange={changeTab}
        label={t('tabs')}
        tabs={SEARCH_TABS.map((tab) => ({
          value: tab,
          label: tab === 'all' ? t('allKinds') : kinds(tab),
        }))}
      >
        <TabsPanel value={state.type} className="grid gap-6">
          <div
            role="group"
            aria-label={t('filters')}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {filters.map((name) => controls[name])}
          </div>
          {pending ? (
            <Loading className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-56 rounded-xl" />
              ))}
            </Loading>
          ) : (
            children
          )}
        </TabsPanel>
      </Tabs>
    </div>
  );
}

/** The search browser, with the URL state it keeps the search in (ADR 0094). */
export function SearchBrowser(props: SearchBrowserProps) {
  return (
    <UrlStateProvider>
      <Browser {...props} />
    </UrlStateProvider>
  );
}

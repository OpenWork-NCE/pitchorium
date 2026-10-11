'use client';

import { useTranslations } from 'next-intl';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { type ReactNode, useTransition } from 'react';
import { UrlStateProvider } from '@/components/layout/url-state';
import { DeferredSelect, Field, Loading, Skeleton, Tabs, TabsPanel } from '@/components/ui';
import { MISSION_DIRECTIONS, MISSION_KINDS, MISSION_MODES } from '../lib/limits';
import { ENGAGEMENT_ROLES, MISSION_TABS, type MissionTab } from '../lib/missions-query';

interface Option {
  value: string;
  label: string;
}

const ALL = 'all';

const parsers = {
  tab: parseAsStringLiteral(MISSION_TABS).withDefault('all'),
  direction: parseAsStringLiteral(MISSION_DIRECTIONS),
  kind: parseAsStringLiteral(MISSION_KINDS),
  mode: parseAsStringLiteral(MISSION_MODES),
  sector: parseAsString,
  country: parseAsString,
  language: parseAsString,
  role: parseAsStringLiteral(ENGAGEMENT_ROLES),
};

const OPTIONS = { shallow: false, history: 'push' } as const;

interface MissionsBrowserProps {
  signedIn: boolean;
  countries: readonly Option[];
  sectors: readonly Option[];
  languages: readonly Option[];
  children: ReactNode;
}

/**
 * The views and filters of the missions (§6.3), in the address: every open mission (offers and
 * requests), and for a member « Mes missions » and « Mes engagements »; sense, field, mode,
 * sector, country, language.
 */
function Browser({ signedIn, countries, sectors, languages, children }: MissionsBrowserProps) {
  const t = useTranslations('web.missions.list');
  const reference = useTranslations('reference');
  const [pending, startTransition] = useTransition();
  const [state, setState] = useQueryStates(parsers, { ...OPTIONS, startTransition });
  const tabs: MissionTab[] = signedIn ? [...MISSION_TABS] : ['all'];
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
  const content = (
    <>
      {state.tab === 'all' ? (
        <form
          role="search"
          aria-label={t('filters')}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
          onSubmit={(event) => event.preventDefault()}
        >
          {select('direction', t('direction'), values('missionDirections', MISSION_DIRECTIONS))}
          {select('kind', t('kind'), values('timeEntryKinds', MISSION_KINDS))}
          {select('mode', t('mode'), values('missionModes', MISSION_MODES))}
          {select('sector', t('sector'), sectors)}
          {select('country', t('country'), countries)}
          {select('language', t('language'), languages)}
        </form>
      ) : state.tab === 'engagements' ? (
        <div role="group" aria-label={t('filters')} className="grid gap-4 sm:max-w-xs">
          {select(
            'role',
            t('role'),
            ENGAGEMENT_ROLES.map((role) => ({ value: role, label: t(`roles.${role}`) })),
          )}
        </div>
      ) : null}
      {pending ? (
        <Loading className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-56 rounded-xl" />
          ))}
        </Loading>
      ) : (
        children
      )}
    </>
  );
  if (tabs.length === 1) return <div className="grid gap-6">{content}</div>;
  return (
    <Tabs
      value={state.tab}
      onValueChange={(tab) =>
        void setState({
          tab: tab === 'all' ? null : tab,
          direction: null,
          kind: null,
          mode: null,
          sector: null,
          country: null,
          language: null,
          role: null,
        })
      }
      label={t('views')}
      tabs={tabs.map((tab) => ({ value: tab, label: t(`tabs.${tab}`) }))}
    >
      <TabsPanel value={state.tab} className="grid gap-6">
        {content}
      </TabsPanel>
    </Tabs>
  );
}

export function MissionsBrowser(props: MissionsBrowserProps) {
  return (
    <UrlStateProvider>
      <Browser {...props} />
    </UrlStateProvider>
  );
}

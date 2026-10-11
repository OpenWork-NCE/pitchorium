'use client';

import { useTranslations } from 'next-intl';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { type ReactNode, useTransition } from 'react';
import { UrlStateProvider } from '@/components/layout/url-state';
import {
  DateTimeField,
  DeferredSelect,
  Field,
  Loading,
  Skeleton,
  Tabs,
  TabsPanel,
} from '@/components/ui';
import { EVENT_TABS, type EventTab, MY_ROLES } from '../lib/events-query';
import { EVENT_FORMATS } from '../lib/limits';

interface Option {
  value: string;
  label: string;
}

const ALL = 'all';

const parsers = {
  tab: parseAsStringLiteral(EVENT_TABS).withDefault('upcoming'),
  role: parseAsStringLiteral(MY_ROLES).withDefault('attendee'),
  format: parseAsStringLiteral(EVENT_FORMATS),
  country: parseAsString,
  sector: parseAsString,
  language: parseAsString,
  from: parseAsString,
};

/** A change renders the list again on the server: shareable and indexable. */
const OPTIONS = { shallow: false, history: 'push' } as const;

interface EventsBrowserProps {
  signedIn: boolean;
  countries: readonly Option[];
  sectors: readonly Option[];
  languages: readonly Option[];
  children: ReactNode;
}

/**
 * The views and filters of the events (§14), in the address (nuqs): upcoming, past, and for a
 * member « Mes événements » (registered or organized); type, starting day, country, sector,
 * language. The tabs share the gliding indicator; the list gives way to its skeletons meanwhile.
 */
function Browser({ signedIn, countries, sectors, languages, children }: EventsBrowserProps) {
  const t = useTranslations('web.events.list');
  const reference = useTranslations('reference');
  const [pending, startTransition] = useTransition();
  const [state, setState] = useQueryStates(parsers, { ...OPTIONS, startTransition });
  const tabs: EventTab[] = signedIn ? [...EVENT_TABS] : ['upcoming', 'past'];
  const select = (
    name: 'format' | 'country' | 'sector' | 'language',
    label: string,
    options: readonly Option[],
  ) => (
    <Field label={label}>
      <DeferredSelect
        value={state[name] ?? ALL}
        onValueChange={(value) => void setState({ [name]: value === ALL ? null : value })}
        options={[{ value: ALL, label: t('any') }, ...options]}
      />
    </Field>
  );
  return (
    <Tabs
      value={state.tab}
      onValueChange={(tab) => void setState({ tab: tab === 'upcoming' ? null : tab, from: null })}
      label={t('views')}
      tabs={tabs.map((tab) => ({ value: tab, label: t(`tabs.${tab}`) }))}
    >
      <TabsPanel value={state.tab} className="grid gap-6">
        {state.tab === 'mine' ? (
          <div role="group" aria-label={t('filters')} className="grid gap-4 sm:max-w-xs">
            <Field label={t('role')}>
              <DeferredSelect
                value={state.role}
                onValueChange={(value) =>
                  void setState({ role: value === 'attendee' ? null : value })
                }
                options={MY_ROLES.map((role) => ({ value: role, label: t(`roles.${role}`) }))}
              />
            </Field>
          </div>
        ) : (
          <form
            role="search"
            aria-label={t('filters')}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
            onSubmit={(event) => event.preventDefault()}
          >
            {select(
              'format',
              t('format'),
              EVENT_FORMATS.map((format) => ({
                value: format,
                label: reference(`eventFormats.${format}`),
              })),
            )}
            {state.tab === 'upcoming' ? (
              <Field label={t('from')}>
                <DateTimeField
                  granularity="day"
                  value={state.from ?? null}
                  onChange={(next) => void setState({ from: next })}
                />
              </Field>
            ) : null}
            {select('country', t('country'), countries)}
            {select('sector', t('sector'), sectors)}
            {select('language', t('language'), languages)}
          </form>
        )}
        {pending ? (
          <Loading className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-80 rounded-xl" />
            ))}
          </Loading>
        ) : (
          children
        )}
      </TabsPanel>
    </Tabs>
  );
}

/** The browser of the events, with the URL state it keeps its view and filters in. */
export function EventsBrowser(props: EventsBrowserProps) {
  return (
    <UrlStateProvider>
      <Browser {...props} />
    </UrlStateProvider>
  );
}

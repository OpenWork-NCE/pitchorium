'use client';

import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import {
  createContext,
  type ReactNode,
  type TransitionStartFunction,
  use,
  useTransition,
} from 'react';
import { UrlStateProvider } from '@/components/layout/url-state';
import { Button, DeferredSelect, Field, Loading, Skeleton } from '@/components/ui';
import { SHOWCASE_IMPACTS, SHOWCASE_SORTS, SHOWCASE_STATUSES } from './showcase-query';

interface Option {
  value: string;
  label: string;
}

const ALL = 'all';

const parsers = {
  country: parseAsString,
  sector: parseAsString,
  status: parseAsStringLiteral(SHOWCASE_STATUSES),
  impact: parseAsStringLiteral(SHOWCASE_IMPACTS),
  sort: parseAsStringLiteral(SHOWCASE_SORTS).withDefault('recent'),
};

/** A change of filter renders the page again on the server: shareable and indexable. */
const OPTIONS = { shallow: false, history: 'push' } as const;

const TransitionContext = createContext<TransitionStartFunction | null>(null);

function useShowcaseFilters() {
  const startTransition = use(TransitionContext) ?? undefined;
  return useQueryStates(parsers, { ...OPTIONS, startTransition });
}

/**
 * The filters and the sort of the showcase (§10.6), in the address (nuqs): each change asks the
 * server for the page again (the grid stays server-rendered), the grid giving way to its
 * skeletons in the meantime. The cards are the children.
 */
function Browser({
  countries,
  sectors,
  impactAvailable,
  children,
}: {
  countries: readonly Option[];
  sectors: readonly Option[];
  /** The impact filter, only once a methodology is published (§12, ADR 0036). */
  impactAvailable: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('web.projects.showcase');
  const statuses = useTranslations('reference.projectStatuses');
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useQueryStates(parsers, { ...OPTIONS, startTransition });
  const select = (
    name: 'country' | 'sector' | 'status' | 'impact',
    label: string,
    options: readonly Option[],
  ) => (
    <Field label={label}>
      <DeferredSelect
        value={filters[name] ?? ALL}
        onValueChange={(value) => void setFilters({ [name]: value === ALL ? null : value })}
        options={[{ value: ALL, label: t('all') }, ...options]}
      />
    </Field>
  );
  return (
    <TransitionContext value={startTransition}>
      <div className="grid gap-6">
        <form
          role="search"
          aria-label={t('filters')}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(event) => event.preventDefault()}
        >
          {select('country', t('country'), countries)}
          {select('sector', t('sector'), sectors)}
          {select(
            'status',
            t('status'),
            SHOWCASE_STATUSES.map((status) => ({ value: status, label: statuses(status) })),
          )}
          {impactAvailable
            ? select(
                'impact',
                t('impact'),
                SHOWCASE_IMPACTS.map((impact) => ({
                  value: impact,
                  label: t('impactAtLeast', { score: impact }),
                })),
              )
            : null}
          <Field label={t('sort')}>
            <DeferredSelect
              value={filters.sort}
              onValueChange={(value) => void setFilters({ sort: value })}
              options={SHOWCASE_SORTS.map((sort) => ({ value: sort, label: t(`sorts.${sort}`) }))}
            />
          </Field>
        </form>
        {pending ? (
          <Loading className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-96 rounded-xl" />
            ))}
          </Loading>
        ) : (
          children
        )}
      </div>
    </TransitionContext>
  );
}

/** The showcase browser, with the URL state it keeps its filters in (ADR 0094). */
export function ShowcaseBrowser(props: Parameters<typeof Browser>[0]) {
  return (
    <UrlStateProvider>
      <Browser {...props} />
    </UrlStateProvider>
  );
}

/** « Réinitialiser les filtres », the action of an empty showcase (filters too narrow). */
export function ResetFilters() {
  const t = useTranslations('web.projects.showcase');
  const [, setFilters] = useShowcaseFilters();
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => void setFilters({ country: null, sector: null, status: null, impact: null })}
    >
      <RotateCcw aria-hidden />
      {t('reset')}
    </Button>
  );
}

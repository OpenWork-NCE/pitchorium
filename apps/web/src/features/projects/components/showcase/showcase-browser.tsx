'use client';

import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import {
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  type TransitionStartFunction,
  use,
  useState,
  useTransition,
} from 'react';
import { UrlStateProvider } from '@/components/layout/url-state';
import { Button, DeferredSelect, Field, Loading, Skeleton, Tag } from '@/components/ui';
import { cn } from '@/lib/cn';
import { usePlural } from '@/lib/i18n/plural';
import {
  type ActiveFilter,
  activeFilters,
  SHOWCASE_IMPACTS,
  SHOWCASE_SORTS,
  SHOWCASE_STATUSES,
} from './showcase-query';

interface Option {
  value: string;
  label: string;
}

const ALL = 'all';

const FiltersSheet = lazy(() => import('./filters-sheet'));

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
 * server for the page again (the grid stays server-rendered), the results giving way to their
 * skeletons in the meantime. On a computer, a compact bar of dropdown buttons (each shows its
 * field until a value is chosen) and the sort; on a phone, « Filtres » and the count of those in
 * force open a sheet. Below, the count of the results, the filters in force as removable chips
 * and the reset. The results are the children.
 */
function Browser({
  countries,
  sectors,
  impactAvailable,
  results,
  children,
}: {
  countries: readonly Option[];
  sectors: readonly Option[];
  /** The impact filter, only once a methodology is published (§12, ADR 0036). */
  impactAvailable: boolean;
  /** The projects shown, and whether more follow (the api gives no total). */
  results: { shown: number; more: boolean } | null;
  children: ReactNode;
}) {
  const t = useTranslations('web.projects.showcase');
  const locale = useLocale();
  const statuses = useTranslations('reference.projectStatuses');
  const plural = usePlural();
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const [filters, setFilters] = useQueryStates(parsers, { ...OPTIONS, startTransition });
  const fields = {
    country: { label: t('country'), options: countries },
    sector: { label: t('sector'), options: sectors },
    status: {
      label: t('status'),
      options: SHOWCASE_STATUSES.map((status) => ({ value: status, label: statuses(status) })),
    },
    impact: {
      label: t('impact'),
      options: SHOWCASE_IMPACTS.map((impact) => ({
        value: impact,
        label: t('impactAtLeast', { score: impact }),
      })),
    },
  } satisfies Record<ActiveFilter['key'], { label: string; options: readonly Option[] }>;
  const keys = (['country', 'sector', 'status', 'impact'] as const).filter(
    (key) => key !== 'impact' || impactAvailable,
  );
  const active = activeFilters(
    { ...filters, impact: impactAvailable ? filters.impact : null },
    (key, value) =>
      fields[key].options.find((option) => option.value === value)?.label ??
      // A country of the address without project has no option: its name in the language.
      (key === 'country' ? new Intl.DisplayNames(locale, { type: 'region' }).of(value) : undefined),
  );
  const reset = () => void setFilters({ country: null, sector: null, status: null, impact: null });

  /** A filter: in the bar, a dropdown button showing its field until a value is chosen. */
  const select = (key: ActiveFilter['key'], layout: 'bar' | 'sheet') => (
    <Field key={key} label={fields[key].label} hideLabel={layout === 'bar'}>
      <DeferredSelect
        // In the bar, no value shows the field itself (« Pays »), its options start with « Tous ».
        value={filters[key] ?? (layout === 'bar' ? undefined : ALL)}
        placeholder={fields[key].label}
        onValueChange={(value) => void setFilters({ [key]: value === ALL ? null : value })}
        options={[{ value: ALL, label: t('all') }, ...fields[key].options]}
        {...(layout === 'bar'
          ? {
              className: cn(
                'h-10 w-auto max-w-56 min-w-32 rounded-full text-sm data-[placeholder]:text-foreground',
                filters[key] && 'border-accent bg-accent-subtle text-on-accent-subtle',
              ),
            }
          : {})}
      />
    </Field>
  );
  const sort = (layout: 'bar' | 'sheet') => (
    <Field label={t('sort')} hideLabel={layout === 'bar'}>
      <DeferredSelect
        value={filters.sort}
        onValueChange={(value) => void setFilters({ sort: value })}
        options={SHOWCASE_SORTS.map((value) => ({ value, label: t(`sorts.${value}`) }))}
        {...(layout === 'bar' ? { className: 'h-10 w-auto rounded-full text-sm' } : {})}
      />
    </Field>
  );

  return (
    <TransitionContext value={startTransition}>
      <div className="grid gap-6">
        <form
          role="search"
          aria-label={t('filters')}
          className="grid gap-4"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {keys.map((key) => select(key, 'bar'))}
            <div className="ml-auto">{sort('bar')}</div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="justify-self-start md:hidden"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            onClick={() => {
              setSheetMounted(true);
              setSheetOpen(true);
            }}
          >
            <SlidersHorizontal aria-hidden />
            {t('filtersButton')}
            {active.length > 0 ? (
              <>
                <span
                  aria-hidden
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs text-on-accent tabular-nums"
                >
                  {active.length}
                </span>
                <span className="sr-only">
                  {t(`activeFilters.${plural(active.length)}`, { count: active.length })}
                </span>
              </>
            ) : null}
          </Button>
          {sheetMounted ? (
            <Suspense fallback={null}>
              <FiltersSheet
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                title={t('filters')}
                closeLabel={t('showResults')}
              >
                <div className="grid gap-4">
                  {keys.map((key) => select(key, 'sheet'))}
                  {sort('sheet')}
                </div>
              </FiltersSheet>
            </Suspense>
          ) : null}
        </form>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {results ? (
            <p className="text-sm font-medium tabular-nums" role="status">
              {results.more
                ? t('resultsMore', { count: results.shown })
                : t(`results.${plural(results.shown)}`, { count: results.shown })}
            </p>
          ) : null}
          {active.length > 0 ? (
            <>
              <ul aria-label={t('active')} className="flex flex-wrap gap-2">
                {active.map((filter) => (
                  <li key={filter.key}>
                    <Tag
                      removeLabel={t('removeFilter', { label: filter.label })}
                      onRemove={() => void setFilters({ [filter.key]: null })}
                    >
                      {filter.label}
                    </Tag>
                  </li>
                ))}
              </ul>
              <Button type="button" variant="link" size="sm" onClick={reset}>
                {t('reset')}
              </Button>
            </>
          ) : null}
        </div>
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

'use client';

import { useTranslations } from 'next-intl';
import { parseAsString, useQueryStates } from 'nuqs';
import { type ReactNode, useTransition } from 'react';
import { Field, FilterButtons, Select } from '@/components/ui';

/** The empty choice of a select: the filter is off. */
const ALL = '__all__';

export interface UrlFilter {
  /** Its parameter in the address. */
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  /** `buttons` for two to four choices, a select beyond. */
  control?: 'buttons' | 'select';
  /** The choice when the address has none (a button group always has one pressed). */
  defaultValue?: string;
}

/**
 * The filters of a list of the console, in the address (nuqs): each change asks the server for
 * the list again, the results waiting meanwhile (`aria-busy` on the children). The api filters,
 * the address only carries the choice.
 */
export function UrlFilters({
  filters,
  children,
}: {
  filters: readonly UrlFilter[];
  children: ReactNode;
}) {
  const t = useTranslations('web.admin.common');
  const [pending, startTransition] = useTransition();
  const parsers = Object.fromEntries(filters.map((filter) => [filter.name, parseAsString]));
  const [state, setState] = useQueryStates(parsers, {
    shallow: false,
    history: 'push',
    startTransition,
  });
  return (
    // Columns of minmax(0, 1fr): a long row of filters scrolls instead of widening the page.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div role="group" aria-label={t('filters')} className="flex flex-wrap items-end gap-3">
        {filters.map((filter) =>
          filter.control === 'buttons' ? (
            <FilterButtons
              key={filter.name}
              label={filter.label}
              options={filter.options}
              value={state[filter.name] ?? filter.defaultValue ?? filter.options[0]?.value ?? ''}
              onValueChange={(value) =>
                void setState({ [filter.name]: value === filter.defaultValue ? null : value })
              }
            />
          ) : (
            <Field key={filter.name} label={filter.label} className="min-w-44">
              <Select
                value={state[filter.name] ?? ALL}
                onValueChange={(value) =>
                  void setState({ [filter.name]: value === ALL ? null : value })
                }
                options={[{ value: ALL, label: t('all') }, ...filter.options]}
              />
            </Field>
          ),
        )}
      </div>
      <div
        aria-busy={pending || undefined}
        className={pending ? 'opacity-60 transition-opacity' : undefined}
      >
        {children}
      </div>
    </div>
  );
}

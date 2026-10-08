'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/cn';
import { Pagination } from './pagination';
import { Skeleton } from './skeleton';

export interface TableColumn<Row> {
  key: string;
  header: ReactNode;
  /** Text of the header for the sort button's name, when the header is not text. */
  headerLabel?: string;
  cell: (row: Row) => ReactNode;
  sortable?: boolean;
  align?: 'start' | 'end';
  /** The cell that names the row (`th scope=row`), the title of its card on a phone. */
  rowHeader?: boolean;
  /** Actions of the row: at the end of its card on a phone, without a label. */
  actions?: boolean;
  className?: string;
}

export interface TableSort {
  key: string;
  direction: 'ascending' | 'descending';
}

interface TableProps<Row> {
  /** Title of the table, read first by screen readers; visible unless `hideCaption`. */
  caption: ReactNode;
  hideCaption?: boolean;
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  sort?: TableSort;
  onSortChange?: (sort: TableSort) => void;
  /** First load: skeleton rows of the same shape. */
  loading?: boolean;
  /** Shown instead of the rows when there is none (an EmptyState). */
  empty?: ReactNode;
  /** Cursor pagination: more rows after these. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
  /** `compact` for the administration only (direction.md). */
  density?: 'comfortable' | 'compact';
  className?: string;
}

/**
 * Table of data: a header that sticks while its body scrolls, sorting by column (`aria-sort`, a
 * button per sortable header), cursor pagination, loading and empty states. From 768 px, the
 * first column sticks while the table scrolls sideways, with a shadow once it has scrolled;
 * below, each row is a card (its title, then each column as a term and its value, then its
 * actions).
 */
export function Table<Row>({
  caption,
  hideCaption = false,
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  loading = false,
  empty,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  density = 'comfortable',
  className,
}: TableProps<Row>) {
  const t = useTranslations('web.ui.table');
  const [scrolled, setScrolled] = useState(false);
  const cell = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';
  const showEmpty = !loading && rows.length === 0 && empty;
  const labelOf = (column: TableColumn<Row>) =>
    column.headerLabel ?? (typeof column.header === 'string' ? column.header : column.key);
  // The first column sticks; a shadow says the rest scrolled under it.
  const sticky = (header: boolean) =>
    cn(
      'sticky left-0 z-[1]',
      header ? 'z-[2] bg-surface-sunken' : 'bg-surface',
      scrolled && 'shadow-[6px_0_8px_-6px_rgb(var(--shadow-color)/0.35)]',
    );
  const titleColumn = columns.find((column) => column.rowHeader) ?? columns[0];

  return (
    <div className={cn('grid gap-4', className)}>
      {/* Below 768 px: one card per row, the same data as the table. */}
      <section aria-label={typeof caption === 'string' ? caption : undefined} className="md:hidden">
        {hideCaption ? null : <p className="mb-3 font-semibold">{caption}</p>}
        <ul className="grid gap-3">
          {loading
            ? [0, 1, 2].map((index) => (
                <li
                  key={index}
                  aria-hidden
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-3/4" />
                </li>
              ))
            : rows.map((row) => (
                <li
                  key={rowKey(row)}
                  className="grid gap-3 rounded-xl border border-border bg-surface p-4 text-sm"
                >
                  {titleColumn ? <div className="font-medium">{titleColumn.cell(row)}</div> : null}
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
                    {columns
                      .filter((column) => column !== titleColumn && !column.actions)
                      .map((column) => (
                        <div key={column.key} className="contents">
                          <dt className="text-muted">{labelOf(column)}</dt>
                          <dd
                            className={cn(
                              'min-w-0 wrap-anywhere',
                              column.align === 'end' && 'tabular-nums',
                            )}
                          >
                            {column.cell(row)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                  {columns
                    .filter((column) => column.actions)
                    .map((column) => (
                      <div
                        key={column.key}
                        className="flex justify-end gap-2 border-t border-border pt-2"
                      >
                        {column.cell(row)}
                      </div>
                    ))}
                </li>
              ))}
        </ul>
        {showEmpty ? (
          <div className="rounded-xl border border-border bg-surface p-6">{empty}</div>
        ) : null}
      </section>
      <div
        // A scroll region the keyboard can reach (WCAG 2.1.1).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        role="region"
        aria-label={typeof caption === 'string' ? caption : undefined}
        onScroll={(event) => setScrolled(event.currentTarget.scrollLeft > 0)}
        className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-surface outline-none focus-visible:outline-2 focus-visible:outline-focus max-md:hidden"
      >
        <table className="w-full border-collapse text-sm">
          <caption
            className={cn('px-4 pt-4 pb-2 text-left font-semibold', hideCaption && 'sr-only')}
          >
            {caption}
          </caption>
          <thead className="sticky top-0 z-[1] bg-surface-sunken">
            <tr>
              {columns.map((column, index) => {
                const sorted = sort?.key === column.key ? sort.direction : undefined;
                const label = labelOf(column);
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={column.sortable ? (sorted ?? 'none') : undefined}
                    className={cn(
                      cell,
                      'border-b border-border font-medium whitespace-nowrap text-muted',
                      column.align === 'end' ? 'text-right' : 'text-left',
                      index === 0 && sticky(true),
                    )}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSortChange({
                            key: column.key,
                            direction: sorted === 'ascending' ? 'descending' : 'ascending',
                          })
                        }
                        aria-label={t(sorted === 'ascending' ? 'sortDescending' : 'sortAscending', {
                          column: label,
                        })}
                        className={cn(
                          'inline-flex cursor-pointer items-center gap-1 rounded-xs outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus',
                          column.align === 'end' && 'flex-row-reverse',
                          sorted && 'text-foreground',
                        )}
                      >
                        {column.header}
                        {sorted === 'ascending' ? (
                          <ArrowUp aria-hidden className="size-4" />
                        ) : sorted === 'descending' ? (
                          <ArrowDown aria-hidden className="size-4" />
                        ) : (
                          <ArrowUpDown aria-hidden className="size-4 opacity-60" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? [0, 1, 2, 3, 4].map((index) => (
                  <tr key={index} aria-hidden>
                    {columns.map((column, index) => (
                      <td
                        key={column.key}
                        className={cn(
                          cell,
                          'border-b border-border last:border-b-0',
                          index === 0 && sticky(false),
                        )}
                      >
                        <Skeleton className="h-4 w-full max-w-40" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className="border-b border-border transition-colors duration-(--duration-micro) last:border-b-0 hover:bg-surface-sunken/60"
                  >
                    {columns.map((column, index) => {
                      const Tag = column.rowHeader ? 'th' : 'td';
                      return (
                        <Tag
                          key={column.key}
                          scope={column.rowHeader ? 'row' : undefined}
                          className={cn(
                            cell,
                            column.rowHeader && 'font-medium',
                            column.align === 'end' ? 'text-right tabular-nums' : 'text-left',
                            index === 0 && sticky(false),
                            column.className,
                          )}
                        >
                          {column.cell(row)}
                        </Tag>
                      );
                    })}
                  </tr>
                ))}
          </tbody>
        </table>
        {loading ? (
          <p className="sr-only" role="status">
            {t('loading')}
          </p>
        ) : null}
        {showEmpty ? <div className="border-t border-border p-6">{empty}</div> : null}
      </div>
      {onLoadMore && !loading && rows.length > 0 ? (
        <Pagination
          hasMore={hasMore}
          onLoadMore={onLoadMore}
          loading={loadingMore}
          shown={rows.length}
        />
      ) : null}
    </div>
  );
}

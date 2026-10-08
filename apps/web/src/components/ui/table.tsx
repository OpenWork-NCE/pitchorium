'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
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
  /** The cell that names the row (`th scope=row`). */
  rowHeader?: boolean;
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
 * button per sortable header), cursor pagination, loading and empty states. Scrolls sideways on
 * a narrow screen rather than squeezing its columns.
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
  const cell = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3';
  const showEmpty = !loading && rows.length === 0 && empty;

  return (
    <div className={cn('grid gap-4', className)}>
      <div
        // A scroll region the keyboard can reach (WCAG 2.1.1).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        role="region"
        aria-label={typeof caption === 'string' ? caption : undefined}
        className="max-h-[70vh] overflow-auto rounded-xl border border-border bg-surface outline-none focus-visible:outline-2 focus-visible:outline-focus"
      >
        <table className="w-full border-collapse text-sm">
          <caption
            className={cn('px-4 pt-4 pb-2 text-left font-semibold', hideCaption && 'sr-only')}
          >
            {caption}
          </caption>
          <thead className="sticky top-0 z-[1] bg-surface-sunken">
            <tr>
              {columns.map((column) => {
                const sorted = sort?.key === column.key ? sort.direction : undefined;
                const label =
                  column.headerLabel ??
                  (typeof column.header === 'string' ? column.header : column.key);
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={column.sortable ? (sorted ?? 'none') : undefined}
                    className={cn(
                      cell,
                      'border-b border-border font-medium whitespace-nowrap text-muted',
                      column.align === 'end' ? 'text-right' : 'text-left',
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
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(cell, 'border-b border-border last:border-b-0')}
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
                    {columns.map((column) => {
                      const Tag = column.rowHeader ? 'th' : 'td';
                      return (
                        <Tag
                          key={column.key}
                          scope={column.rowHeader ? 'row' : undefined}
                          className={cn(
                            cell,
                            column.rowHeader && 'font-medium',
                            column.align === 'end' ? 'text-right tabular-nums' : 'text-left',
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

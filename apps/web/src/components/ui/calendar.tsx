'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef } from 'react';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/cn';
import { weekStartOf } from '@/lib/format/zoned-time';

/** A day of the Gregorian calendar, without time nor zone. */
interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

interface CalendarProps {
  selected: CalendarDay | null;
  onSelect: (day: CalendarDay) => void;
  /** Earliest day that can be chosen. */
  min?: CalendarDay | undefined;
  /** The month shown first, the selected one by default. */
  defaultMonth?: CalendarDay | undefined;
  className?: string;
}

/** Local midnight of a day: the grid of react-day-picker reads local dates. */
const toDate = ({ year, month, day }: CalendarDay) => new Date(year, month - 1, day);
const fromDate = (date: Date): CalendarDay => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
});

/**
 * Month grid to pick a day (react-day-picker, ADR 0100): captions, weekday names and spoken
 * labels formatted by Intl in the language of the page, the first day of the week of that
 * language, arrows, Page Up and Down, Home and End on the grid.
 */
export function Calendar({ selected, onSelect, min, defaultMonth, className }: CalendarProps) {
  const locale = useLocale();
  const t = useTranslations('web.ui.calendar');
  const formats = useMemo(
    () => ({
      caption: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
      weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }),
      weekdayLong: new Intl.DateTimeFormat(locale, { weekday: 'long' }),
      day: new Intl.DateTimeFormat(locale, { day: 'numeric' }),
      full: new Intl.DateTimeFormat(locale, { dateStyle: 'full' }),
    }),
    [locale],
  );
  const start = defaultMonth ?? selected ?? undefined;
  const root = useRef<HTMLDivElement>(null);
  // Opened from a field, the grid takes the focus on the selected day, today, or the first day
  // that can be chosen: the arrows move from there.
  useEffect(() => {
    const grid = root.current;
    const day =
      grid?.querySelector<HTMLButtonElement>('[data-selected="true"] button') ??
      grid?.querySelector<HTMLButtonElement>('[data-today="true"] button:not([disabled])') ??
      grid?.querySelector<HTMLButtonElement>('[role="gridcell"] button:not([disabled])');
    day?.focus();
  }, []);
  return (
    <div ref={root}>
      <DayPicker
        mode="single"
        lang={locale}
        weekStartsOn={weekStartOf(locale)}
        selected={selected ? toDate(selected) : undefined}
        onSelect={(date) => {
          if (date) onSelect(fromDate(date));
        }}
        defaultMonth={start ? toDate(start) : undefined}
        disabled={min ? { before: toDate(min) } : undefined}
        showOutsideDays
        fixedWeeks
        formatters={{
          formatCaption: (month) => formats.caption.format(month),
          formatWeekdayName: (date) => formats.weekday.format(date),
          formatDay: (date) => formats.day.format(date),
        }}
        labels={{
          labelNav: () => t('navigation'),
          labelGrid: (month) => formats.caption.format(month),
          labelNext: () => t('nextMonth'),
          labelPrevious: () => t('previousMonth'),
          labelWeekday: (date) => formats.weekdayLong.format(date),
          labelDayButton: (date, modifiers) =>
            [
              formats.full.format(date),
              modifiers.today ? t('today') : null,
              modifiers.selected ? t('selected') : null,
            ]
              .filter(Boolean)
              .join(', '),
        }}
        components={{
          Chevron: ({ orientation }) =>
            orientation === 'left' ? (
              <ChevronLeft aria-hidden className="size-5" />
            ) : (
              <ChevronRight aria-hidden className="size-5" />
            ),
        }}
        className={cn('text-sm', className)}
        classNames={{
          root: 'relative',
          months: 'grid',
          month: 'grid gap-3',
          month_caption: 'flex h-10 items-center px-1',
          caption_label: 'font-semibold first-letter:uppercase',
          nav: 'absolute top-0 right-0 flex h-10 items-center gap-1',
          button_previous:
            'inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-foreground outline-none hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40',
          button_next:
            'inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-foreground outline-none hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40',
          month_grid: 'w-full border-collapse',
          weekdays: '',
          weekday: 'h-9 w-10 text-center text-xs font-medium text-muted',
          week: '',
          day: 'p-0 text-center',
          day_button:
            'inline-flex size-10 cursor-pointer items-center justify-center rounded-full tabular-nums outline-none hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed',
          today: 'font-semibold text-link',
          selected:
            '[&>button]:bg-accent [&>button]:text-on-accent [&>button]:hover:bg-accent-strong',
          outside: 'text-muted',
          disabled: 'text-muted opacity-50',
          hidden: 'invisible',
          focused: '',
        }}
      />
    </div>
  );
}

'use client';

import { now } from '@internationalized/date';
import { CalendarDays } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  type KeyboardEvent,
  lazy,
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/cn';
import {
  dateTimeLayout,
  dayPeriods,
  EMPTY,
  eraseDigit,
  fromWallDateTime,
  type PartialDateTime,
  type SegmentType,
  segmentLength,
  segmentRange,
  segmentValue,
  stepSegment,
  toWallDateTime,
  typeDigit,
  withSegment,
} from '@/lib/format/date-segments';
import { instantToWallTime, wallTimeToInstant } from '@/lib/format/zoned-time';
import { preloadWhenIdle } from '@/lib/preload';
import { useFieldControl, useFieldLabelId } from './field';
import { controlClasses } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Skeleton } from './skeleton';

/** The month grid (react-day-picker) loads when the page is idle, before the first opening. */
const loadCalendar = () => import('./calendar');
const Calendar = lazy(() => loadCalendar().then((module) => ({ default: module.Calendar })));

interface DateTimeFieldProps {
  /** Instant in ISO 8601 (UTC), null while incomplete. */
  value: string | null;
  onChange: (instant: string | null) => void;
  /**
   * IANA zone of the wall clock typed (the place of an event): named once next to the dates of
   * the form (TimeZoneSelect), never under each field.
   */
  timeZone: string;
  /** Earliest day of the calendar, `YYYY-MM-DD`. */
  minDate?: string;
  disabled?: boolean | undefined;
  id?: string | undefined;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: boolean | undefined;
  'aria-required'?: boolean | undefined;
}

/** Larger steps of Page Up and Page Down. */
const PAGE_STEP: Record<SegmentType, number> = {
  year: 5,
  month: 2,
  day: 7,
  hour: 2,
  minute: 15,
  dayPeriod: 1,
};

function partsOf(value: string | null, zone: string): PartialDateTime {
  return value ? fromWallDateTime(instantToWallTime(value, zone)) : EMPTY;
}

function instantOf(parts: PartialDateTime, zone: string): string | null {
  const wall = toWallDateTime(parts);
  return wall ? wallTimeToInstant(wall, zone) : null;
}

/**
 * Date and time typed segment by segment (ADR 0100), in the order and on the clock of the
 * language of the application (20/11/2026 18:05 in French, 11/20/2026, 6:05 PM in English),
 * whatever the browser. Each segment is a spin button: digits, arrows (Page Up and Down for
 * larger steps), Home and End, Backspace; Left and Right move between segments. The day can
 * also be picked in a calendar. The wall clock is that of `timeZone`; the value is an instant.
 */
export function DateTimeField({
  value,
  onChange,
  timeZone,
  minDate,
  ...props
}: DateTimeFieldProps) {
  const locale = useLocale();
  const t = useTranslations('web.ui.dateTime');
  const control = useFieldControl(props);
  const labelId = useFieldLabelId();
  const generated = useId();
  const layout = dateTimeLayout(locale);
  const periods = useMemo(() => dayPeriods(locale), [locale]);
  const segments = useRef<(HTMLSpanElement | null)[]>([]);
  const [parts, setPartsState] = useState(() => partsOf(value, timeZone));
  const [typed, setTypedState] = useState('');
  // What the handlers read: moving the focus runs the blur of the left segment before the next
  // render, with the state of the previous one.
  const current = useRef({ parts, typed });
  function setParts(next: PartialDateTime) {
    current.current.parts = next;
    setPartsState(next);
  }
  function setTyped(next: string) {
    current.current.typed = next;
    setTypedState(next);
  }
  useLayoutEffect(() => {
    current.current = { parts, typed };
  }, [parts, typed]);
  const [open, setOpen] = useState(false);
  // The value and zone last seen: a new value from outside replaces what is typed.
  const [seen, setSeen] = useState({ value, timeZone });
  if (seen.value !== value || seen.timeZone !== timeZone) {
    setSeen({ value, timeZone });
    if (value !== instantOf(parts, seen.timeZone)) setPartsState(partsOf(value, timeZone));
  }

  // The zone changes under a complete date: the same wall clock, another instant.
  const zone = useRef(timeZone);
  useEffect(() => {
    if (zone.current === timeZone) return;
    zone.current = timeZone;
    const next = instantOf(parts, timeZone);
    if (next !== value) onChange(next);
  }, [timeZone, parts, value, onChange]);

  useEffect(() => preloadWhenIdle(loadCalendar), []);

  const types = layout.items.flatMap((item) => (item.type === 'literal' ? [] : [item.type]));
  const disabled = Boolean(control.disabled);

  function commit(next: PartialDateTime) {
    setParts(next);
    const instant = instantOf(next, timeZone);
    if (instant !== value) {
      setSeen({ value: instant, timeZone });
      onChange(instant);
    }
  }

  function focusAt(index: number) {
    segments.current[Math.max(0, Math.min(types.length - 1, index))]?.focus();
  }

  function reference() {
    const current = now(timeZone);
    return {
      year: current.year,
      month: current.month,
      day: current.day,
      hour: current.hour,
      minute: current.minute,
    };
  }

  function input(type: SegmentType, index: number, character: string) {
    if (type === 'dayPeriod') {
      const lower = character.toLocaleLowerCase(locale);
      const match = periods.findIndex((period) =>
        period.toLocaleLowerCase(locale).startsWith(lower),
      );
      if (match >= 0) {
        commit(withSegment(current.current.parts, type, match, layout.hour12));
        focusAt(index + 1);
      }
      return;
    }
    if (!/^\d$/.test(character)) return;
    const step = typeDigit(
      current.current.parts,
      type,
      current.current.typed,
      character,
      layout.hour12,
    );
    setTyped(step.typed);
    // A year is complete at four digits: no instant of the year 2 while 2026 is being typed.
    if (type === 'year' && step.typed) setParts(step.parts);
    else commit(step.parts);
    if (step.advance) focusAt(index + 1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>, type: SegmentType, index: number) {
    const { parts: latest, typed: pending } = current.current;
    const { min, max } = segmentRange(type, latest, layout.hour12);
    const step = (delta: number) => {
      setTyped('');
      commit(stepSegment(latest, type, delta, layout.hour12, reference()));
    };
    const handled = () => event.preventDefault();
    switch (event.key) {
      case 'ArrowUp':
        handled();
        step(1);
        return;
      case 'ArrowDown':
        handled();
        step(-1);
        return;
      case 'PageUp':
        handled();
        step(PAGE_STEP[type]);
        return;
      case 'PageDown':
        handled();
        step(-PAGE_STEP[type]);
        return;
      case 'Home':
        handled();
        setTyped('');
        commit(withSegment(latest, type, min, layout.hour12));
        return;
      case 'End':
        handled();
        setTyped('');
        commit(withSegment(latest, type, max, layout.hour12));
        return;
      case 'ArrowLeft':
        handled();
        focusAt(index - 1);
        return;
      case 'ArrowRight':
        handled();
        focusAt(index + 1);
        return;
      case 'Backspace':
      case 'Delete': {
        handled();
        const empty = segmentValue(type, latest, layout.hour12) === null && !pending;
        if (empty && event.key === 'Backspace') {
          focusAt(index - 1);
          return;
        }
        const erased = eraseDigit(latest, type, pending, layout.hour12);
        setTyped(erased.typed);
        commit(erased.parts);
        return;
      }
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          handled();
          input(type, index, event.key);
        }
    }
  }

  // Virtual keyboards send no usable key: their text arrives as `beforeinput`.
  useEffect(() => {
    const listeners = segments.current.map((element, index) => {
      const type = types[index];
      if (!element || !type) return () => undefined;
      const listener = (event: InputEvent) => {
        event.preventDefault();
        if (event.inputType === 'deleteContentBackward') {
          const erased = eraseDigit(
            current.current.parts,
            type,
            current.current.typed,
            layout.hour12,
          );
          setTyped(erased.typed);
          commit(erased.parts);
          return;
        }
        for (const character of event.data ?? '') input(type, index, character);
      };
      element.addEventListener('beforeinput', listener);
      return () => element.removeEventListener('beforeinput', listener);
    });
    return () => {
      for (const remove of listeners) remove();
    };
  });

  function display(type: SegmentType, focused: boolean): { text: string; empty: boolean } {
    if (focused && typed) return { text: typed, empty: false };
    const shown = segmentValue(type, parts, layout.hour12);
    if (shown === null) return { text: t(`placeholders.${type}`), empty: true };
    if (type === 'dayPeriod') return { text: periods[shown] ?? '', empty: false };
    return { text: String(shown).padStart(segmentLength(type), '0'), empty: false };
  }

  function spoken(type: SegmentType): string {
    const said = segmentValue(type, parts, layout.hour12);
    if (said === null) return t('empty');
    if (type === 'dayPeriod') return periods[said] ?? '';
    if (type === 'month') {
      const name = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
        new Date(Date.UTC(2026, said - 1, 1)),
      );
      return `${said}, ${name}`;
    }
    return String(said);
  }

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const selectedDay =
    parts.year !== null && parts.month !== null && parts.day !== null
      ? { year: parts.year, month: parts.month, day: parts.day }
      : null;
  const [minYear, minMonth, minDay] = (minDate ?? '').split('-').map(Number);
  const min =
    minYear && minMonth && minDay ? { year: minYear, month: minMonth, day: minDay } : undefined;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={control['aria-describedby']}
      aria-disabled={disabled || undefined}
      className={cn(
        controlClasses,
        'flex h-11 min-w-fit items-center gap-1 pr-1 pl-3 focus-within:border-focus',
        control['aria-invalid'] && 'border-danger',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <div className="flex flex-1 items-center tabular-nums">
        {layout.items.map((item, position) => {
          if (item.type === 'literal') {
            return (
              <span key={`literal-${position}`} aria-hidden className="whitespace-pre text-muted">
                {item.text}
              </span>
            );
          }
          const type = item.type;
          const segmentIndex = types.indexOf(type);
          const { min: low, max: high } = segmentRange(type, parts, layout.hour12);
          const now = segmentValue(type, parts, layout.hour12);
          const shown = display(type, focusedIndex === segmentIndex);
          return (
            <span
              key={type}
              ref={(element) => {
                segments.current[segmentIndex] = element;
              }}
              id={segmentIndex === 0 ? control.id : `${generated}-${type}`}
              role="spinbutton"
              tabIndex={disabled ? -1 : 0}
              contentEditable={!disabled}
              suppressContentEditableWarning
              inputMode={type === 'dayPeriod' ? 'text' : 'numeric'}
              enterKeyHint="next"
              autoCorrect="off"
              spellCheck={false}
              aria-label={t(`segments.${type}`)}
              aria-valuemin={low}
              aria-valuemax={high}
              aria-valuenow={now ?? undefined}
              aria-valuetext={spoken(type)}
              aria-describedby={control['aria-describedby']}
              aria-invalid={control['aria-invalid'] || undefined}
              aria-required={control['aria-required'] || undefined}
              aria-disabled={disabled || undefined}
              data-placeholder={shown.empty ? '' : undefined}
              onKeyDown={(event) => onKeyDown(event, type, segmentIndex)}
              onFocus={() => {
                setFocusedIndex(segmentIndex);
                setTyped('');
              }}
              onBlur={() => {
                setFocusedIndex(null);
                if (current.current.typed) {
                  setTyped('');
                  commit(current.current.parts);
                }
              }}
              onPaste={(event) => event.preventDefault()}
              className={cn(
                // At least 24 px wide, the minimal target (WCAG 2.5.8); a year keeps the width of
                // its four digits while empty or typed, so that nothing moves while typing.
                'min-w-6 rounded-xs px-px text-center caret-transparent outline-none focus:bg-accent focus:text-on-accent',
                type === 'year' && (shown.empty || focusedIndex === segmentIndex) && 'min-w-[4ch]',
                shown.empty && 'text-muted focus:text-on-accent',
              )}
            >
              {shown.text}
            </span>
          );
        })}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          aria-label={t('openCalendar')}
          aria-describedby={control['aria-describedby']}
          className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted outline-none hover:bg-surface-sunken hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus max-sm:size-11"
        >
          <CalendarDays aria-hidden className="size-5" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-3">
          <Suspense fallback={<Skeleton className="h-80 w-72" />}>
            <Calendar
              selected={selectedDay}
              min={min}
              defaultMonth={selectedDay ?? reference()}
              onSelect={(day) => {
                commit({ ...current.current.parts, ...day });
                setOpen(false);
              }}
            />
          </Suspense>
        </PopoverContent>
      </Popover>
    </div>
  );
}

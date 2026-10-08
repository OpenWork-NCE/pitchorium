'use client';

import { Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { cn } from '@/lib/cn';
import { instantToWallTime, wallTimeToInstant, zoneLabel } from '@/lib/format/zoned-time';
import { useFieldControl, useFieldLabelId } from './field';
import { controlClasses } from './input';

interface DateTimeInputProps {
  /** Instant in ISO 8601 (UTC), null while incomplete. */
  value: string | null;
  onChange: (instant: string | null) => void;
  /** IANA zone the person types in (the place of an event, the zone of the member). */
  timeZone: string;
  /** Earliest day that can be chosen, `YYYY-MM-DD`. */
  minDate?: string;
  disabled?: boolean | undefined;
  id?: string | undefined;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: boolean | undefined;
  'aria-required'?: boolean | undefined;
}

/**
 * Date and time typed as the wall clock of a time zone, stored as an instant: the zone is named
 * under the fields (an event in Dakar is entered in Dakar time wherever the organiser is).
 * Native date and time controls: the keyboard and the calendar of the platform.
 */
export function DateTimeInput({
  value,
  onChange,
  timeZone,
  minDate,
  ...props
}: DateTimeInputProps) {
  const locale = useLocale();
  const t = useTranslations('web.ui.dateTime');
  const control = useFieldControl(props);
  const labelId = useFieldLabelId();
  const zoneId = useId();
  const [wall, setWall] = useState(() =>
    value ? instantToWallTime(value, timeZone) : { date: '', time: '' },
  );

  function update(next: { date: string; time: string }) {
    setWall(next);
    onChange(next.date && next.time ? wallTimeToInstant(next, timeZone) : null);
  }

  const describedBy = cn(control['aria-describedby'], zoneId) || undefined;
  return (
    <div role="group" aria-labelledby={labelId} className="grid gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,8rem)] gap-2">
        <input
          id={control.id}
          type="date"
          aria-label={t('date')}
          aria-describedby={describedBy}
          aria-invalid={control['aria-invalid']}
          aria-required={control['aria-required']}
          disabled={control.disabled}
          min={minDate}
          value={wall.date}
          onChange={(event) => update({ ...wall, date: event.target.value })}
          className={cn(controlClasses, 'h-11 min-w-0 px-3')}
        />
        <input
          type="time"
          aria-label={t('time')}
          aria-describedby={describedBy}
          aria-invalid={control['aria-invalid']}
          aria-required={control['aria-required']}
          disabled={control.disabled}
          step={300}
          value={wall.time}
          onChange={(event) => update({ ...wall, time: event.target.value })}
          className={cn(controlClasses, 'h-11 min-w-0 px-3 tabular-nums')}
        />
      </div>
      <p id={zoneId} className="inline-flex items-center gap-1.5 text-xs text-muted">
        <Globe aria-hidden className="size-4" />
        {t('zone', { zone: zoneLabel(timeZone, locale) })}
      </p>
    </div>
  );
}

'use client';

import { useFormatter, useNow } from 'next-intl';
import { cn } from '@/lib/cn';
import { Tooltip } from './tooltip';

interface RelativeTimeProps {
  /** Instant in ISO 8601. */
  date: string;
  className?: string;
}

/**
 * "il y a 5 minutes", kept up to date every minute; the full date and time in the time zone of
 * the member as a tooltip and in the `datetime` attribute.
 */
export function RelativeTime({ date, className }: RelativeTimeProps) {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const instant = new Date(date);
  const full = format.dateTime(instant, { dateStyle: 'full', timeStyle: 'short' });
  return (
    <Tooltip content={full}>
      {/* Focusable so that the full date shows to the keyboard too (WCAG 1.4.13). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <time dateTime={date} tabIndex={0} className={cn('rounded-xs', className)}>
        {format.relativeTime(instant, now)}
      </time>
    </Tooltip>
  );
}

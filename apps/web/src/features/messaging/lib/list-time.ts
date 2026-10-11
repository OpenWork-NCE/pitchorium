/**
 * The moment of the last message of a conversation in a list, as short as it stays clear: the
 * time today, the day of the week within the last six days, the date beyond (the year when it is
 * not the current one). Pure; the days are counted in the time zone of the reader.
 */
export type ListTime =
  | { kind: 'time'; options: Intl.DateTimeFormatOptions }
  | { kind: 'weekday'; options: Intl.DateTimeFormatOptions }
  | { kind: 'date'; options: Intl.DateTimeFormatOptions };

function dayIn(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function listTime(at: Date, now: Date, timeZone: string): ListTime {
  const day = dayIn(at, timeZone);
  const today = dayIn(now, timeZone);
  if (day === today) return { kind: 'time', options: { timeStyle: 'short', timeZone } };
  const days = Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000);
  if (days > 0 && days < 7) return { kind: 'weekday', options: { weekday: 'short', timeZone } };
  return {
    kind: 'date',
    options: {
      day: 'numeric',
      month: 'short',
      ...(day.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
      timeZone,
    },
  };
}

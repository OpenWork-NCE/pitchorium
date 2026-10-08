import { parseAbsolute, toCalendarDate } from '@internationalized/date';

/**
 * Messages of a conversation as they are read (A5): split by day in the time zone of the reader,
 * then in groups of consecutive messages of one author written within GROUP_GAP_MINUTES of the
 * previous one. Pure, for any message shape that names its author and its instant.
 */
export const GROUP_GAP_MINUTES = 5;

export interface Groupable {
  /** The author (`me` for the reader's own messages). */
  author: string;
  createdAt: string;
}

export interface MessageGroup<T extends Groupable> {
  author: string;
  messages: T[];
}

export interface MessageDay<T extends Groupable> {
  /** `YYYY-MM-DD` in the time zone of the reader. */
  day: string;
  groups: MessageGroup<T>[];
}

/** Day of an instant in a time zone, `YYYY-MM-DD`. */
export function dayOf(instant: string, timeZone: string): string {
  return toCalendarDate(parseAbsolute(instant, timeZone)).toString();
}

export function groupMessages<T extends Groupable>(
  messages: readonly T[],
  timeZone: string,
): MessageDay<T>[] {
  const days: MessageDay<T>[] = [];
  let previous: T | undefined;
  for (const message of messages) {
    const day = dayOf(message.createdAt, timeZone);
    let current = days.at(-1);
    if (current?.day !== day) {
      current = { day, groups: [] };
      days.push(current);
      previous = undefined;
    }
    const group = current.groups.at(-1);
    const close =
      previous !== undefined &&
      Date.parse(message.createdAt) - Date.parse(previous.createdAt) <= GROUP_GAP_MINUTES * 60_000;
    if (group && previous?.author === message.author && close) group.messages.push(message);
    else current.groups.push({ author: message.author, messages: [message] });
    previous = message;
  }
  return days;
}

/** Days between two `YYYY-MM-DD` dates (0 the same day, 1 the day before). */
export function daysBetween(day: string, today: string): number {
  return Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000,
  );
}

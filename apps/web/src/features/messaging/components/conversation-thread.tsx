import type { MemberCard, Message } from '@pitchorium/contracts';
import { CheckCheck, Check } from 'lucide-react';
import { useFormatter, useNow, useTimeZone, useTranslations } from 'next-intl';
import { Avatar, Tooltip } from '@/components/ui';
import { cn } from '@/lib/cn';
import { dayOf, daysBetween, groupMessages } from '@/lib/format/message-groups';

interface ConversationThreadProps {
  messages: readonly Message[];
  /** The other participant of a conversation between two members. */
  other: MemberCard;
  /** Last message the other participant read (`participants[].lastReadSequence`). */
  otherLastReadSequence: number;
  /** Level of the headings of the days in the outline of the page. */
  dayHeadingLevel?: 2 | 3;
}

/**
 * Messages of a conversation (§10.4): one separator per day (« Aujourd'hui », « Hier », then the
 * date), the consecutive messages of one author grouped (the avatar once, a tighter spacing), the
 * short time under the last message of a group with the full date in a tooltip, and « Lu » under
 * the last message sent once the other participant has read it.
 */
export function ConversationThread({
  messages,
  other,
  otherLastReadSequence,
  dayHeadingLevel = 3,
}: ConversationThreadProps) {
  const t = useTranslations('web.messaging');
  const format = useFormatter();
  const timeZone = useTimeZone() ?? 'UTC';
  const now = useNow({ updateInterval: 60_000 });
  const today = dayOf(now.toISOString(), timeZone);
  const days = groupMessages(
    messages.map((message) => ({ ...message, author: message.mine ? 'me' : 'other' })),
    timeZone,
  );
  const lastSent = messages.findLast((message) => message.mine);
  const DayHeading = `h${dayHeadingLevel}` as const;

  function dayLabel(day: string): string {
    const distance = daysBetween(day, today);
    if (distance === 0) return t('today');
    if (distance === 1) return t('yesterday');
    const date = new Date(`${day}T12:00:00Z`);
    const sameYear = day.slice(0, 4) === today.slice(0, 4);
    return format.dateTime(date, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(sameYear ? {} : { year: 'numeric' }),
      timeZone: 'UTC',
    });
  }

  return (
    <ol aria-label={t('history')} className="grid gap-5">
      {days.map((day) => (
        <li key={day.day} className="grid gap-3">
          <DayHeading className="text-center text-xs font-medium text-muted first-letter:uppercase">
            {dayLabel(day.day)}
          </DayHeading>
          <ol className="grid gap-3">
            {day.groups.map((group) => {
              const mine = group.author === 'me';
              const last = group.messages.at(-1);
              return (
                <li
                  key={group.messages[0]?.id}
                  className={cn('flex items-end gap-2', mine && 'flex-row-reverse')}
                >
                  {mine ? null : (
                    <Avatar name={other.displayName} src={other.avatarUrl} size="sm" decorative />
                  )}
                  <div
                    className={cn(
                      'grid max-w-[80%] gap-0.5',
                      mine ? 'justify-items-end' : 'justify-items-start',
                    )}
                  >
                    <span className="sr-only">
                      {mine ? t('youWrote') : t('wrote', { name: other.displayName })}
                    </span>
                    {group.messages.map((message, index) => (
                      <p
                        key={message.id}
                        className={cn(
                          'rounded-2xl px-4 py-2.5 text-sm text-pretty whitespace-pre-line',
                          mine ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-foreground',
                          // The corner on the side of the author is tighter inside a group.
                          mine
                            ? cn(
                                index > 0 && 'rounded-tr-md',
                                index < group.messages.length - 1 && 'rounded-br-md',
                              )
                            : cn(
                                index > 0 && 'rounded-tl-md',
                                index < group.messages.length - 1 && 'rounded-bl-md',
                              ),
                          message.body === null && 'italic opacity-80',
                        )}
                      >
                        {message.body ?? t('deleted')}
                        {message.edited && message.body !== null ? (
                          <span className="ml-1 text-xs opacity-80">{t('edited')}</span>
                        ) : null}
                      </p>
                    ))}
                    {last ? (
                      <p className="flex items-center gap-1.5 px-1 text-xs text-muted">
                        <Tooltip
                          content={format.dateTime(new Date(last.createdAt), {
                            dateStyle: 'full',
                            timeStyle: 'short',
                          })}
                        >
                          <time
                            dateTime={last.createdAt}
                            // Focusable: the full date shows to the keyboard too (WCAG 1.4.13).
                            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                            tabIndex={0}
                            className="rounded-xs tabular-nums"
                          >
                            {format.dateTime(new Date(last.createdAt), { timeStyle: 'short' })}
                          </time>
                        </Tooltip>
                        {last.id === lastSent?.id ? (
                          last.sequence <= otherLastReadSequence ? (
                            <span className="inline-flex items-center gap-1">
                              <span aria-hidden>·</span>
                              <CheckCheck aria-hidden className="size-4" />
                              {t('read')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <span aria-hidden>·</span>
                              <Check aria-hidden className="size-4" />
                              {t('sent')}
                            </span>
                          )
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}

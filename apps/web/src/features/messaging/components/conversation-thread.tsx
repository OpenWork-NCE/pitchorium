'use client';

import type { ConversationParticipant, MemberCard, Message } from '@pitchorium/contracts';
import { useFormatter, useNow, useTimeZone, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Avatar, RelativeTime } from '@/components/ui';
import { cn } from '@/lib/cn';
import { dayOf, daysBetween } from '@/lib/format/message-groups';
import { type PendingMessage, receiptOf } from '../lib/thread';
import { threadRows, type ThreadItem, type ThreadRow } from '../lib/thread-rows';
import { MessageBubble, SendState } from './message-bubble';

export interface ThreadContext {
  /** The other participants: their cards and their reading positions. */
  participants: readonly ConversationParticipant[];
  /** A group shows the name of each author above their messages. */
  group: boolean;
  /** The last message the reader sent, which shows its receipt. */
  lastSentId: string | null;
  dayHeadingLevel: 2 | 3;
  /** Actions of a message of the reader (edit, delete). */
  renderActions?: (message: Message) => ReactNode;
  onRetry?: (pending: PendingMessage) => void;
  onDiscard?: (pending: PendingMessage) => void;
  /** Keys of the rows that arrived after the opening (they fade in). */
  fresh?: ReadonlySet<string>;
}

function useDayLabel() {
  const t = useTranslations('web.messaging');
  const format = useFormatter();
  const timeZone = useTimeZone() ?? 'UTC';
  const now = useNow({ updateInterval: 60_000 });
  const today = dayOf(now.toISOString(), timeZone);
  return (day: string): string => {
    const distance = daysBetween(day, today);
    if (distance === 0) return t('today');
    if (distance === 1) return t('yesterday');
    const sameYear = day.slice(0, 4) === today.slice(0, 4);
    return format.dateTime(new Date(`${day}T12:00:00Z`), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(sameYear ? {} : { year: 'numeric' }),
      timeZone: 'UTC',
    });
  };
}

const cardOf = (participants: readonly ConversationParticipant[], handle: string) =>
  participants.find((participant) => participant.member.handle === handle)?.member;

/** One row of a thread: the heading of a day, or a message in the group of its author. */
export function ThreadRowView({ row, context }: { row: ThreadRow; context: ThreadContext }) {
  const t = useTranslations('web.messaging');
  const dayLabel = useDayLabel();
  if (row.kind === 'day') {
    const Heading = `h${context.dayHeadingLevel}` as const;
    return (
      <Heading className="pt-5 pb-2 text-center text-xs font-medium text-muted first-letter:uppercase">
        {dayLabel(row.day)}
      </Heading>
    );
  }
  const mine = row.author === 'me';
  const card: MemberCard | undefined = mine ? undefined : cardOf(context.participants, row.author);
  const name = card?.displayName ?? t('someone');
  const item: ThreadItem = row.item;
  const stored = item.state === 'stored' ? item.message : null;
  const showReceipt = stored !== null && stored.id === context.lastSentId;
  const meta = row.last ? (
    <p className="flex items-center gap-1.5 px-1 text-xs text-muted">
      {item.state === 'stored' ? (
        <RelativeTime date={item.message.createdAt} style="time" className="tabular-nums" />
      ) : null}
      {showReceipt ? (
        <>
          <span aria-hidden>·</span>
          <SendState
            state={receiptOf(stored, context.participants)}
            label={t(receiptOf(stored, context.participants))}
          />
        </>
      ) : null}
    </p>
  ) : null;
  return (
    <div
      className={cn(
        'flex items-end gap-2',
        mine && 'flex-row-reverse',
        row.first ? 'pt-3' : 'pt-0.5',
      )}
    >
      {mine ? null : row.last ? (
        <Avatar name={name} src={card?.avatarUrl ?? null} size="sm" decorative />
      ) : (
        <span aria-hidden className="w-8 shrink-0" />
      )}
      <div
        className={cn(
          'grid max-w-[85%] min-w-0 gap-0.5 sm:max-w-[75%]',
          mine ? 'justify-items-end' : 'justify-items-start',
        )}
      >
        {row.first ? (
          context.group && !mine ? (
            <p className="px-1 text-xs font-medium text-muted">{name}</p>
          ) : (
            <span className="sr-only">{mine ? t('youWrote') : t('wrote', { name })}</span>
          )
        ) : null}
        <MessageBubble
          item={item}
          mine={mine}
          first={row.first}
          last={row.last}
          meta={meta}
          fresh={context.fresh?.has(row.key) ?? false}
          actions={stored && mine ? context.renderActions?.(stored) : undefined}
          {...(context.onRetry ? { onRetry: context.onRetry } : {})}
          {...(context.onDiscard ? { onDiscard: context.onDiscard } : {})}
        />
      </div>
    </div>
  );
}

interface ConversationThreadProps {
  messages: readonly Message[];
  pending?: readonly PendingMessage[];
  participants: readonly ConversationParticipant[];
  group?: boolean;
  /** Level of the headings of the days in the outline of the page. */
  dayHeadingLevel?: 2 | 3;
}

/**
 * Messages of a conversation without virtualization (§10.4): one heading per day (« Aujourd'hui »,
 * « Hier », then the date), the consecutive messages of one author grouped (the avatar once, a
 * tighter spacing), the short time under the last message of a group with the full date in a
 * tooltip, and « Lu » under the last message sent once every other participant read it. The open
 * conversation renders the same rows in its scroller (ThreadScroller).
 */
export function ConversationThread({
  messages,
  pending = [],
  participants,
  group = false,
  dayHeadingLevel = 3,
}: ConversationThreadProps) {
  const t = useTranslations('web.messaging');
  const timeZone = useTimeZone() ?? 'UTC';
  const rows = threadRows(messages, pending, timeZone);
  const context: ThreadContext = {
    participants,
    group,
    lastSentId: messages.findLast((message) => message.mine)?.id ?? null,
    dayHeadingLevel,
  };
  return (
    <ol aria-label={t('history')} className="grid">
      {rows.map((row) => (
        <li key={row.key}>
          <ThreadRowView row={row} context={context} />
        </li>
      ))}
    </ol>
  );
}

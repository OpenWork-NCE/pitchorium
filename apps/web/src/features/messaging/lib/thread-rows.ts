import type { Message } from '@pitchorium/contracts';
import { groupMessages } from '@/lib/format/message-groups';
import type { PendingMessage } from './thread';

/** A message of the thread: stored by the api, or being sent by the reader. */
export type ThreadItem =
  { state: 'stored'; message: Message } | { state: 'pending'; message: PendingMessage };

/** A row of the virtualized thread: the separator of a day, or a message in its group. */
export type ThreadRow =
  | { kind: 'day'; key: string; day: string }
  | {
      kind: 'message';
      key: string;
      item: ThreadItem;
      /** `me`, the handle of the sender, or `unknown` for a sender no longer shown. */
      author: string;
      first: boolean;
      last: boolean;
    };

const authorOf = (item: ThreadItem): string =>
  item.state === 'pending' || item.message.mine ? 'me' : (item.message.senderHandle ?? 'unknown');

/** Key of a message row: its client id, the same while sent and once stored (no remount). */
export const rowKey = (item: ThreadItem): string => `m:${item.message.clientMessageId}`;

/**
 * The rows of a thread (A5 grouping, message-groups.ts): a separator per day in the time zone of
 * the reader, then each message with its place in the group of its author; the messages being
 * sent come last, in the order they were written.
 */
export function threadRows(
  stored: readonly Message[],
  pending: readonly PendingMessage[],
  timeZone: string,
): ThreadRow[] {
  const items: (ThreadItem & { author: string; createdAt: string })[] = [
    ...stored.map((message) => ({ state: 'stored' as const, message })),
    ...pending.map((message) => ({ state: 'pending' as const, message })),
  ].map((item) => ({ ...item, author: authorOf(item), createdAt: item.message.createdAt }));
  const rows: ThreadRow[] = [];
  for (const day of groupMessages(items, timeZone)) {
    rows.push({ kind: 'day', key: `d:${day.day}`, day: day.day });
    for (const group of day.groups) {
      group.messages.forEach((item, index) => {
        const threadItem = { state: item.state, message: item.message } as ThreadItem;
        rows.push({
          kind: 'message',
          key: rowKey(threadItem),
          item: threadItem,
          author: group.author,
          first: index === 0,
          last: index === group.messages.length - 1,
        });
      });
    }
  }
  return rows;
}

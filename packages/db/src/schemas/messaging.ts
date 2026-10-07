import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const messagingSchema = pgSchema('messaging');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const sequence = (name: string) => bigint(name, { mode: 'number' });

/**
 * Conversations (§10.4, ADR 0055): `direct` between two members (one per pair, `direct_key`),
 * `group` of three created by an introduction. `status`: `active`, `request` (first message
 * out of network, waiting for the recipient) or `declined` (silently, for the sender).
 * `last_sequence` numbers the messages of the conversation; its row lock serializes the sends.
 */
export const messagingConversations = messagingSchema.table(
  'conversations',
  {
    id: uuid('id').primaryKey(),
    kind: text('kind').notNull(),
    /** `least:greatest` of the two member ids of a direct conversation. */
    directKey: text('direct_key'),
    status: text('status').notNull(),
    /** Sender and recipient of a message request. */
    requestedBy: uuid('requested_by'),
    requestRecipientId: uuid('request_recipient_id'),
    requestDecidedAt: timestamptz('request_decided_at'),
    introductionId: uuid('introduction_id'),
    createdBy: uuid('created_by').notNull(),
    lastSequence: sequence('last_sequence').notNull().default(0),
    lastMessageAt: timestamptz('last_message_at').notNull(),
    createdAt: timestamptz('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('conversations_direct_key_uq')
      .on(table.directKey)
      .where(sql`${table.directKey} is not null`),
    index('conversations_requests_idx')
      .on(table.requestedBy, table.createdAt)
      .where(sql`${table.requestedBy} is not null`),
  ],
);

/**
 * Participants of a conversation, generic (`participant_type`, `participant_id`): `member`
 * today, other kinds later without migration. Per-participant state: read position, archive,
 * mute, marked unread, departure.
 */
export const messagingParticipants = messagingSchema.table(
  'participants',
  {
    conversationId: uuid('conversation_id').notNull(),
    participantType: text('participant_type').notNull(),
    participantId: uuid('participant_id').notNull(),
    lastReadSequence: sequence('last_read_sequence').notNull().default(0),
    markedUnread: boolean('marked_unread').notNull().default(false),
    archivedAt: timestamptz('archived_at'),
    muted: boolean('muted').notNull().default(false),
    joinedAt: timestamptz('joined_at').notNull(),
    leftAt: timestamptz('left_at'),
  },
  (table) => [
    primaryKey({
      name: 'participants_pk',
      columns: [table.conversationId, table.participantType, table.participantId],
    }),
    index('participants_member_idx').on(table.participantId, table.conversationId),
  ],
);

/**
 * Messages, numbered by `sequence` in their conversation. `client_message_id` deduplicates the
 * sends of one sender. Deletion keeps a tombstone (`deleted_at`, content cleared).
 */
export const messagingMessages = messagingSchema.table(
  'messages',
  {
    id: uuid('id').primaryKey(),
    conversationId: uuid('conversation_id').notNull(),
    sequence: sequence('sequence').notNull(),
    senderId: uuid('sender_id').notNull(),
    clientMessageId: text('client_message_id').notNull(),
    /** `text`, or `introduction` for the note of the introducer opening a group. */
    kind: text('kind').notNull(),
    body: text('body').notNull(),
    attachmentIds: uuid('attachment_ids')
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    sharedPostId: uuid('shared_post_id'),
    moderationStatus: text('moderation_status').notNull().default('visible'),
    createdAt: timestamptz('created_at').notNull(),
    editedAt: timestamptz('edited_at'),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => [
    uniqueIndex('messages_sequence_uq').on(table.conversationId, table.sequence),
    uniqueIndex('messages_client_id_uq').on(table.senderId, table.clientMessageId),
    index('messages_sender_idx').on(table.senderId, table.createdAt),
  ],
);

/**
 * Introductions (ADR 0058): the introducer, connected to both members, proposes; each answers.
 * Both accept: a group conversation opens with the note as first message.
 */
export const messagingIntroductions = messagingSchema.table(
  'introductions',
  {
    id: uuid('id').primaryKey(),
    introducerId: uuid('introducer_id').notNull(),
    firstId: uuid('first_id').notNull(),
    secondId: uuid('second_id').notNull(),
    note: text('note').notNull(),
    firstAnswer: text('first_answer').notNull(),
    secondAnswer: text('second_answer').notNull(),
    status: text('status').notNull(),
    conversationId: uuid('conversation_id'),
    createdAt: timestamptz('created_at').notNull(),
    decidedAt: timestamptz('decided_at'),
  },
  (table) => [
    uniqueIndex('introductions_pending_uq')
      .on(
        table.introducerId,
        sql`least(${table.firstId}, ${table.secondId})`,
        sql`greatest(${table.firstId}, ${table.secondId})`,
      )
      .where(sql`${table.status} = 'pending'`),
    index('introductions_first_idx').on(table.firstId, table.createdAt),
    index('introductions_second_idx').on(table.secondId, table.createdAt),
    index('introductions_introducer_idx').on(table.introducerId, table.createdAt),
  ],
);

/** Who may write to a member out of network (§10.4); a missing row means the default. */
export const messagingSettings = messagingSchema.table('settings', {
  userId: uuid('user_id').primaryKey(),
  messagePolicy: text('message_policy').notNull(),
  updatedAt: timestamptz('updated_at').notNull(),
});

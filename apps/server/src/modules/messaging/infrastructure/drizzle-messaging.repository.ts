import { Injectable } from '@nestjs/common';
import type {
  ConversationBox,
  ConversationKind,
  IntroductionAnswer,
  IntroductionStatus,
  MessageKind,
  MessageModerationStatus,
  MessagePolicy,
} from '@pitchorium/contracts';
import { and, asc, count, desc, eq, gt, inArray, isNull, lt, or, sql } from '@pitchorium/db/orm';
import type { SQL } from '@pitchorium/db/orm';
import {
  messagingConversations,
  messagingIntroductions,
  messagingMessages,
  messagingParticipants,
  messagingSettings,
} from '@pitchorium/db/schemas/messaging';
import { TransactionManager } from '../../../platform/database';
import type { KeysetPosition } from '../../../platform/kernel';
import { type ConversationListItem, MessagingRepository } from '../application/ports';
import type {
  ConversationRecord,
  ConversationStatus,
  MessageRecord,
  ParticipantRecord,
} from '../domain/conversation';
import { MEMBER_PARTICIPANT } from '../domain/conversation';
import type { IntroductionRecord } from '../domain/introduction';

const conversations = messagingConversations;
const participants = messagingParticipants;
const messages = messagingMessages;
const introductions = messagingIntroductions;

const toConversation = (row: typeof conversations.$inferSelect): ConversationRecord => ({
  ...row,
  kind: row.kind as ConversationKind,
  status: row.status as ConversationStatus,
});

const toMessage = (row: typeof messages.$inferSelect): MessageRecord => ({
  ...row,
  kind: row.kind as MessageKind,
  moderationStatus: row.moderationStatus as MessageModerationStatus,
});

const toIntroduction = (row: typeof introductions.$inferSelect): IntroductionRecord => ({
  ...row,
  firstAnswer: row.firstAnswer as IntroductionAnswer,
  secondAnswer: row.secondAnswer as IntroductionAnswer,
  status: row.status as IntroductionStatus,
});

/** Conversations of the inbox or the archive: active ones, and the requests the member sent. */
function ownedBy(userId: string): SQL | undefined {
  return or(eq(conversations.status, 'active'), eq(conversations.requestedBy, userId));
}

/** No other active participant on either side of a block with the member. */
function withoutHiddenPeers(hiddenPeerIds: readonly string[]): SQL | undefined {
  if (hiddenPeerIds.length === 0) return undefined;
  return sql`not exists (
    select 1 from ${participants} as hidden
    where hidden.conversation_id = ${conversations.id}
      and hidden.left_at is null
      and hidden.participant_id in (${sql.join(
        hiddenPeerIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
  )`;
}

@Injectable()
export class DrizzleMessagingRepository extends MessagingRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async lock(key: string): Promise<void> {
    await this.db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }

  async insertConversation(conversation: ConversationRecord): Promise<void> {
    await this.db.insert(conversations).values(conversation);
  }

  async findConversation(id: string): Promise<ConversationRecord | null> {
    const [row] = await this.db.select().from(conversations).where(eq(conversations.id, id));
    return row ? toConversation(row) : null;
  }

  async findDirect(directKey: string): Promise<ConversationRecord | null> {
    const [row] = await this.db
      .select()
      .from(conversations)
      .where(eq(conversations.directKey, directKey));
    return row ? toConversation(row) : null;
  }

  async updateConversation(
    id: string,
    patch: Partial<Pick<ConversationRecord, 'status' | 'requestDecidedAt'>>,
  ): Promise<void> {
    await this.db.update(conversations).set(patch).where(eq(conversations.id, id));
  }

  async nextSequence(id: string, at: Date): Promise<number> {
    const [row] = await this.db
      .update(conversations)
      .set({ lastSequence: sql`${conversations.lastSequence} + 1`, lastMessageAt: at })
      .where(eq(conversations.id, id))
      .returning({ lastSequence: conversations.lastSequence });
    if (!row) throw new Error(`Conversation ${id} not found`);
    return row.lastSequence;
  }

  async countRequestsSince(requesterId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.requestedBy, requesterId),
          sql`${conversations.createdAt} >= ${since}`,
        ),
      );
    return row?.value ?? 0;
  }

  async insertParticipants(rows: readonly ParticipantRecord[]): Promise<void> {
    if (rows.length > 0) await this.db.insert(participants).values([...rows]);
  }

  async participants(conversationId: string): Promise<ParticipantRecord[]> {
    return this.db
      .select()
      .from(participants)
      .where(eq(participants.conversationId, conversationId));
  }

  async participantsOf(conversationIds: readonly string[]): Promise<ParticipantRecord[]> {
    if (conversationIds.length === 0) return [];
    return this.db
      .select()
      .from(participants)
      .where(inArray(participants.conversationId, [...conversationIds]));
  }

  async updateParticipant(
    conversationId: string,
    participantId: string,
    patch: Partial<
      Pick<
        ParticipantRecord,
        'lastReadSequence' | 'markedUnread' | 'archivedAt' | 'muted' | 'leftAt'
      >
    >,
  ): Promise<void> {
    if (Object.keys(patch).length === 0) return;
    await this.db
      .update(participants)
      .set(patch)
      .where(this.participantKey(conversationId, participantId));
  }

  async advanceRead(
    conversationId: string,
    participantId: string,
    sequence: number,
  ): Promise<number> {
    const [row] = await this.db
      .update(participants)
      .set({ lastReadSequence: sql`greatest(${participants.lastReadSequence}, ${sequence})` })
      .where(this.participantKey(conversationId, participantId))
      .returning({ lastReadSequence: participants.lastReadSequence });
    return row?.lastReadSequence ?? 0;
  }

  async unarchive(conversationId: string): Promise<void> {
    await this.db
      .update(participants)
      .set({ archivedAt: null })
      .where(eq(participants.conversationId, conversationId));
  }

  async conversations(
    userId: string,
    box: ConversationBox,
    hiddenPeerIds: readonly string[],
    after: KeysetPosition | null,
    limit: number,
  ): Promise<ConversationListItem[]> {
    const inBox =
      box === 'requests'
        ? and(eq(conversations.status, 'request'), eq(conversations.requestRecipientId, userId))
        : and(
            ownedBy(userId),
            box === 'archived'
              ? sql`${participants.archivedAt} is not null`
              : isNull(participants.archivedAt),
          );
    const rows = await this.db
      .select({ conversation: conversations, participant: participants })
      .from(participants)
      .innerJoin(conversations, eq(conversations.id, participants.conversationId))
      .where(
        and(
          eq(participants.participantType, MEMBER_PARTICIPANT),
          eq(participants.participantId, userId),
          isNull(participants.leftAt),
          inBox,
          withoutHiddenPeers(hiddenPeerIds),
          after
            ? sql`(${conversations.lastMessageAt}, ${conversations.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.id))
      .limit(limit);
    return rows.map((row) => ({
      conversation: toConversation(row.conversation),
      participant: row.participant,
    }));
  }

  async unreadCounts(
    userId: string,
    conversationIds: readonly string[],
  ): Promise<Map<string, number>> {
    if (conversationIds.length === 0) return new Map();
    const rows = await this.db
      .select({ conversationId: messages.conversationId, value: count() })
      .from(messages)
      .innerJoin(
        participants,
        and(
          eq(participants.conversationId, messages.conversationId),
          eq(participants.participantId, userId),
        ),
      )
      .where(
        and(
          inArray(messages.conversationId, [...conversationIds]),
          gt(messages.sequence, participants.lastReadSequence),
          sql`${messages.senderId} <> ${userId}`,
          isNull(messages.deletedAt),
        ),
      )
      .groupBy(messages.conversationId);
    return new Map(rows.map((row) => [row.conversationId, row.value]));
  }

  async unreadSummary(
    userId: string,
    hiddenPeerIds: readonly string[],
  ): Promise<{ messages: number; conversations: number }> {
    const unread = sql<number>`(
      select count(*) from ${messages}
      where ${messages.conversationId} = ${participants.conversationId}
        and ${messages.sequence} > ${participants.lastReadSequence}
        and ${messages.senderId} <> ${userId}
        and ${messages.deletedAt} is null
    )`;
    const rows = await this.db
      .select({ unread: unread.mapWith(Number), marked: participants.markedUnread })
      .from(participants)
      .innerJoin(conversations, eq(conversations.id, participants.conversationId))
      .where(
        and(
          eq(participants.participantId, userId),
          isNull(participants.leftAt),
          isNull(participants.archivedAt),
          eq(conversations.status, 'active'),
          withoutHiddenPeers(hiddenPeerIds),
        ),
      );
    return {
      messages: rows.reduce((sum, row) => sum + row.unread, 0),
      conversations: rows.filter((row) => row.unread > 0 || row.marked).length,
    };
  }

  async countRequestsReceived(userId: string, hiddenPeerIds: readonly string[]): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.status, 'request'),
          eq(conversations.requestRecipientId, userId),
          withoutHiddenPeers(hiddenPeerIds),
        ),
      );
    return row?.value ?? 0;
  }

  async insertMessage(message: MessageRecord): Promise<void> {
    await this.db.insert(messages).values(message);
  }

  async findMessage(id: string): Promise<MessageRecord | null> {
    const [row] = await this.db.select().from(messages).where(eq(messages.id, id));
    return row ? toMessage(row) : null;
  }

  async findByClientId(senderId: string, clientMessageId: string): Promise<MessageRecord | null> {
    const [row] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.senderId, senderId), eq(messages.clientMessageId, clientMessageId)));
    return row ? toMessage(row) : null;
  }

  async updateMessage(
    id: string,
    patch: Partial<
      Pick<
        MessageRecord,
        'body' | 'attachmentIds' | 'sharedPostId' | 'editedAt' | 'deletedAt' | 'moderationStatus'
      >
    >,
  ): Promise<void> {
    await this.db.update(messages).set(patch).where(eq(messages.id, id));
  }

  async messages(
    conversationId: string,
    range: { afterSequence?: number; beforeSequence?: number },
    limit: number,
  ): Promise<MessageRecord[]> {
    if (range.afterSequence !== undefined) {
      const rows = await this.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            gt(messages.sequence, range.afterSequence),
          ),
        )
        .orderBy(asc(messages.sequence))
        .limit(limit);
      return rows.map(toMessage);
    }
    const rows = await this.db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          range.beforeSequence !== undefined
            ? lt(messages.sequence, range.beforeSequence)
            : undefined,
        ),
      )
      .orderBy(desc(messages.sequence))
      .limit(limit);
    return rows.map(toMessage).reverse();
  }

  async lastMessages(conversationIds: readonly string[]): Promise<Map<string, MessageRecord>> {
    if (conversationIds.length === 0) return new Map();
    const rows = await this.db
      .selectDistinctOn([messages.conversationId])
      .from(messages)
      .where(inArray(messages.conversationId, [...conversationIds]))
      .orderBy(messages.conversationId, desc(messages.sequence));
    return new Map(rows.map((row) => [row.conversationId, toMessage(row)]));
  }

  async messagePolicy(userId: string): Promise<MessagePolicy | null> {
    const [row] = await this.db
      .select({ policy: messagingSettings.messagePolicy })
      .from(messagingSettings)
      .where(eq(messagingSettings.userId, userId));
    return (row?.policy as MessagePolicy | undefined) ?? null;
  }

  async setMessagePolicy(userId: string, policy: MessagePolicy, at: Date): Promise<void> {
    await this.db
      .insert(messagingSettings)
      .values({ userId, messagePolicy: policy, updatedAt: at })
      .onConflictDoUpdate({
        target: messagingSettings.userId,
        set: { messagePolicy: policy, updatedAt: at },
      });
  }

  async insertIntroduction(introduction: IntroductionRecord): Promise<boolean> {
    const inserted = await this.db
      .insert(introductions)
      .values(introduction)
      .onConflictDoNothing()
      .returning({ id: introductions.id });
    return inserted.length > 0;
  }

  async findIntroduction(id: string): Promise<IntroductionRecord | null> {
    const [row] = await this.db.select().from(introductions).where(eq(introductions.id, id));
    return row ? toIntroduction(row) : null;
  }

  async lockIntroduction(id: string): Promise<IntroductionRecord | null> {
    const [row] = await this.db
      .select()
      .from(introductions)
      .where(eq(introductions.id, id))
      .for('update');
    return row ? toIntroduction(row) : null;
  }

  async updateIntroduction(
    id: string,
    patch: Partial<
      Pick<
        IntroductionRecord,
        'firstAnswer' | 'secondAnswer' | 'status' | 'conversationId' | 'decidedAt'
      >
    >,
  ): Promise<void> {
    await this.db.update(introductions).set(patch).where(eq(introductions.id, id));
  }

  async introductions(
    userId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<IntroductionRecord[]> {
    const rows = await this.db
      .select()
      .from(introductions)
      .where(
        and(
          or(
            eq(introductions.introducerId, userId),
            eq(introductions.firstId, userId),
            eq(introductions.secondId, userId),
          ),
          after
            ? sql`(${introductions.createdAt}, ${introductions.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(introductions.createdAt), desc(introductions.id))
      .limit(limit);
    return rows.map(toIntroduction);
  }

  async countIntroductionsAwaiting(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(introductions)
      .where(
        and(
          eq(introductions.status, 'pending'),
          or(
            and(eq(introductions.firstId, userId), eq(introductions.firstAnswer, 'pending')),
            and(eq(introductions.secondId, userId), eq(introductions.secondAnswer, 'pending')),
          ),
        ),
      );
    return row?.value ?? 0;
  }

  private participantKey(conversationId: string, participantId: string): SQL | undefined {
    return and(
      eq(participants.conversationId, conversationId),
      eq(participants.participantType, MEMBER_PARTICIPANT),
      eq(participants.participantId, participantId),
    );
  }
}

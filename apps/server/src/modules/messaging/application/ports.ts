import type { ConversationBox, MessagePolicy } from '@pitchorium/contracts';
import type { KeysetPosition } from '../../../platform/kernel';
import type { ConversationRecord, MessageRecord, ParticipantRecord } from '../domain/conversation';
import type { IntroductionRecord } from '../domain/introduction';

export interface ConversationListItem {
  conversation: ConversationRecord;
  participant: ParticipantRecord;
}

export abstract class MessagingRepository {
  /** Transaction-scoped advisory lock on a key. */
  abstract lock(key: string): Promise<void>;

  abstract insertConversation(conversation: ConversationRecord): Promise<void>;
  abstract findConversation(id: string): Promise<ConversationRecord | null>;
  abstract findDirect(directKey: string): Promise<ConversationRecord | null>;
  abstract updateConversation(
    id: string,
    patch: Partial<Pick<ConversationRecord, 'status' | 'requestDecidedAt'>>,
  ): Promise<void>;
  /** Next sequence of the conversation; the row stays locked until the transaction ends. */
  abstract nextSequence(id: string, at: Date): Promise<number>;
  /** Requests started by a member since a date (anti-abuse). */
  abstract countRequestsSince(requesterId: string, since: Date): Promise<number>;

  abstract insertParticipants(participants: readonly ParticipantRecord[]): Promise<void>;
  abstract participants(conversationId: string): Promise<ParticipantRecord[]>;
  abstract participantsOf(conversationIds: readonly string[]): Promise<ParticipantRecord[]>;
  abstract updateParticipant(
    conversationId: string,
    participantId: string,
    patch: Partial<
      Pick<
        ParticipantRecord,
        'lastReadSequence' | 'markedUnread' | 'archivedAt' | 'muted' | 'leftAt'
      >
    >,
  ): Promise<void>;
  /** Moves the read position forward only; returns the position kept. */
  abstract advanceRead(
    conversationId: string,
    participantId: string,
    sequence: number,
  ): Promise<number>;
  /** New activity brings an archived conversation back to the inbox of everyone. */
  abstract unarchive(conversationId: string): Promise<void>;
  abstract conversations(
    userId: string,
    box: ConversationBox,
    hiddenPeerIds: readonly string[],
    after: KeysetPosition | null,
    limit: number,
  ): Promise<ConversationListItem[]>;
  /** Unread messages by conversation for a participant. */
  abstract unreadCounts(
    userId: string,
    conversationIds: readonly string[],
  ): Promise<Map<string, number>>;
  /** Unread messages and conversations of the inbox, without the hidden peers. */
  abstract unreadSummary(
    userId: string,
    hiddenPeerIds: readonly string[],
  ): Promise<{ messages: number; conversations: number }>;
  abstract countRequestsReceived(userId: string, hiddenPeerIds: readonly string[]): Promise<number>;

  abstract insertMessage(message: MessageRecord): Promise<void>;
  abstract findMessage(id: string): Promise<MessageRecord | null>;
  abstract findByClientId(senderId: string, clientMessageId: string): Promise<MessageRecord | null>;
  abstract updateMessage(
    id: string,
    patch: Partial<
      Pick<
        MessageRecord,
        'body' | 'attachmentIds' | 'sharedPostId' | 'editedAt' | 'deletedAt' | 'moderationStatus'
      >
    >,
  ): Promise<void>;
  abstract messages(
    conversationId: string,
    range: { afterSequence?: number; beforeSequence?: number },
    limit: number,
  ): Promise<MessageRecord[]>;
  abstract lastMessages(conversationIds: readonly string[]): Promise<Map<string, MessageRecord>>;

  abstract messagePolicy(userId: string): Promise<MessagePolicy | null>;
  abstract setMessagePolicy(userId: string, policy: MessagePolicy, at: Date): Promise<void>;

  abstract insertIntroduction(introduction: IntroductionRecord): Promise<boolean>;
  abstract findIntroduction(id: string): Promise<IntroductionRecord | null>;
  abstract lockIntroduction(id: string): Promise<IntroductionRecord | null>;
  abstract updateIntroduction(
    id: string,
    patch: Partial<
      Pick<
        IntroductionRecord,
        'firstAnswer' | 'secondAnswer' | 'status' | 'conversationId' | 'decidedAt'
      >
    >,
  ): Promise<void>;
  abstract introductions(
    userId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<IntroductionRecord[]>;
  abstract countIntroductionsAwaiting(userId: string): Promise<number>;
}

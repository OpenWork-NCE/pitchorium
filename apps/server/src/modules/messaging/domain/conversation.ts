import type {
  ConversationKind,
  MessageKind,
  MessageModerationStatus,
  MessagePolicy,
  RelationDegree,
  RequestState,
} from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

export type ConversationStatus = 'active' | 'request' | 'declined';

export interface ConversationRecord {
  id: string;
  kind: ConversationKind;
  directKey: string | null;
  status: ConversationStatus;
  requestedBy: string | null;
  requestRecipientId: string | null;
  requestDecidedAt: Date | null;
  introductionId: string | null;
  createdBy: string;
  lastSequence: number;
  lastMessageAt: Date;
  createdAt: Date;
}

/** Participants are generic (ADR 0055): only `member` exists today. */
export const MEMBER_PARTICIPANT = 'member';

export interface ParticipantRecord {
  conversationId: string;
  participantType: string;
  participantId: string;
  lastReadSequence: number;
  markedUnread: boolean;
  archivedAt: Date | null;
  muted: boolean;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  sequence: number;
  senderId: string;
  clientMessageId: string;
  kind: MessageKind;
  body: string;
  attachmentIds: string[];
  sharedPostId: string | null;
  moderationStatus: MessageModerationStatus;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}

/** Key of the direct conversation of two members, whatever the order. */
export function directKeyOf(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export type StartDecision =
  | { outcome: 'active' }
  | { outcome: 'request' }
  | { outcome: 'refused'; code: 'MESSAGING_RECIPIENT_NOT_ACCEPTING' }
  | { outcome: 'email_required' };

/**
 * Who may write to whom (§10.4, §7.2, ADR 0055): connected members freely; out of network, a
 * verified email and the policy of the recipient, and the first message is a request.
 * `verified_members` admits any member with a verified email, the only verification a person
 * has today (docs/open-questions.md).
 */
export function decideStart(input: {
  degree: RelationDegree;
  senderEmailVerified: boolean;
  recipientPolicy: MessagePolicy;
}): StartDecision {
  if (input.degree === 'first') return { outcome: 'active' };
  if (!input.senderEmailVerified) return { outcome: 'email_required' };
  switch (input.recipientPolicy) {
    case 'connections_only':
      return { outcome: 'refused', code: 'MESSAGING_RECIPIENT_NOT_ACCEPTING' };
    case 'connections_and_second_degree':
      return input.degree === 'second'
        ? { outcome: 'request' }
        : { outcome: 'refused', code: 'MESSAGING_RECIPIENT_NOT_ACCEPTING' };
    case 'verified_members':
      return { outcome: 'request' };
  }
}

/** What a send does to a conversation, or why it is refused. */
export type SendDecision =
  | { outcome: 'send' }
  | { outcome: 'accept_and_send'; reason: 'answer' | 'connected' }
  | { outcome: 'refused'; code: 'MESSAGING_REQUEST_PENDING' | 'MESSAGING_CANNOT_SEND' };

/**
 * The sender of a request waits for the answer, even after a silent decline; the recipient
 * accepts by replying; members who connected since write freely.
 */
export function decideSend(
  conversation: Pick<ConversationRecord, 'status' | 'requestedBy'>,
  participant: Pick<ParticipantRecord, 'leftAt'>,
  senderId: string,
  connectedNow: boolean,
): SendDecision {
  if (participant.leftAt) return { outcome: 'refused', code: 'MESSAGING_CANNOT_SEND' };
  if (conversation.status === 'active') return { outcome: 'send' };
  if (conversation.requestedBy !== senderId)
    return { outcome: 'accept_and_send', reason: 'answer' };
  if (connectedNow) return { outcome: 'accept_and_send', reason: 'connected' };
  return { outcome: 'refused', code: 'MESSAGING_REQUEST_PENDING' };
}

/** A request as each side sees it: a decline stays invisible to the sender. */
export function requestStateFor(
  conversation: Pick<ConversationRecord, 'status' | 'requestedBy' | 'requestRecipientId'>,
  viewerId: string,
): RequestState {
  if (conversation.status === 'active') return 'none';
  if (conversation.requestedBy === viewerId) return 'sent';
  return conversation.status === 'request' ? 'received' : 'none';
}

export function canSendIn(
  conversation: Pick<ConversationRecord, 'status' | 'requestedBy'>,
  participant: Pick<ParticipantRecord, 'leftAt'>,
  viewerId: string,
): boolean {
  return decideSend(conversation, participant, viewerId, false).outcome !== 'refused';
}

/** A message has a text, an attachment or a shared publication. */
export function assertNotEmpty(content: {
  body: string;
  attachmentIds: readonly string[];
  sharedPostId?: string | undefined;
}): void {
  if (content.body.length === 0 && content.attachmentIds.length === 0 && !content.sharedPostId) {
    throw new DomainError('MESSAGING_MESSAGE_EMPTY', 'Empty message');
  }
}

/** Only the sender edits, within the window after sending, and never a deleted message. */
export function assertEditable(
  message: Pick<MessageRecord, 'senderId' | 'createdAt' | 'deletedAt' | 'kind'>,
  editorId: string,
  now: Date,
  windowMs: number,
): void {
  if (message.senderId !== editorId) {
    throw new DomainError('MESSAGING_NOT_SENDER', 'Only the sender may edit the message');
  }
  if (message.deletedAt) throw new DomainError('MESSAGING_MESSAGE_DELETED', 'Message deleted');
  if (message.kind !== 'text' || now.getTime() - message.createdAt.getTime() > windowMs) {
    throw new DomainError('MESSAGING_EDIT_WINDOW_CLOSED', 'The edit window is closed');
  }
}

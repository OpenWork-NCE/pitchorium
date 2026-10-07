import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../platform/kernel';
import { NetworkFacade } from '../../network';
import {
  type ConversationRecord,
  MEMBER_PARTICIPANT,
  type ParticipantRecord,
} from '../domain/conversation';
import { MessagingRepository } from './ports';

export interface VisibleConversation {
  conversation: ConversationRecord;
  participant: ParticipantRecord;
  participants: ParticipantRecord[];
}

export const activeIds = (participants: readonly ParticipantRecord[]) =>
  participants.filter((p) => p.leftAt === null).map((p) => p.participantId);

/**
 * Who sees a conversation: an active participant, not the recipient of a declined request, and
 * with no block towards another active participant (§10.4: a block hides the conversation).
 */
@Injectable()
export class ConversationAccess {
  constructor(
    private readonly messaging: MessagingRepository,
    private readonly network: NetworkFacade,
  ) {}

  async find(viewerId: string, conversationId: string): Promise<VisibleConversation | null> {
    const conversation = await this.messaging.findConversation(conversationId);
    if (!conversation) return null;
    const participants = await this.messaging.participants(conversationId);
    const participant = participants.find(
      (p) => p.participantType === MEMBER_PARTICIPANT && p.participantId === viewerId,
    );
    if (!participant || participant.leftAt) return null;
    if (conversation.status === 'declined' && conversation.requestRecipientId === viewerId) {
      return null;
    }
    const blocked = new Set(await this.network.blockedUserIds(viewerId));
    if (activeIds(participants).some((id) => blocked.has(id))) return null;
    return { conversation, participant, participants };
  }

  async require(viewerId: string, conversationId: string): Promise<VisibleConversation> {
    const found = await this.find(viewerId, conversationId);
    if (!found) {
      throw new DomainError('MESSAGING_CONVERSATION_NOT_FOUND', 'Conversation not found');
    }
    return found;
  }
}

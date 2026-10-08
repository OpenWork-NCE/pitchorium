import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { MessageModerationStatus } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import { MediaFacade } from '../../media';
import { NetworkFacade } from '../../network';
import { activeIds, ConversationAccess } from './conversation-access';
import { MESSAGE_RESOURCE } from './message-resource';
import { MessagingRepository } from './ports';

export interface UnreadState {
  lastReadSequence: number;
  lastSequence: number;
  muted: boolean;
}

/** Messages shown to a moderator around a reported message (trust module). */
export const REPORT_CONTEXT_MESSAGES_BEFORE = 3;

export interface ReportedMessageContext {
  conversationId: string;
  senderId: string;
  messages: {
    id: string;
    senderId: string;
    sentAt: Date;
    /** Null for a deleted message (tombstone). */
    text: string | null;
    reported: boolean;
  }[];
}

export interface UnreadMessage {
  senderId: string;
  sequence: number;
  body: string;
  attachments: number;
  createdAt: Date;
}

/**
 * Public facade of the messaging module: moderation for trust, counters and unread state for
 * notifications. At startup it gives media the read rule of the files attached to messages:
 * the participants who see the conversation.
 */
@Injectable()
export class MessagingFacade implements OnModuleInit {
  constructor(
    private readonly messaging: MessagingRepository,
    private readonly access: ConversationAccess,
    private readonly network: NetworkFacade,
    private readonly media: MediaFacade,
  ) {}

  onModuleInit(): void {
    this.media.registerReadAuthorizer({
      resourceTypes: [MESSAGE_RESOURCE],
      canRead: async (viewerId, resource) => {
        const message = await this.messaging.findMessage(resource.id);
        if (!message || message.deletedAt || message.moderationStatus !== 'visible') return false;
        return (await this.access.find(viewerId, message.conversationId)) !== null;
      },
    });
  }

  /** Called by the trust module (moderation of a reported message). */
  async setMessageModerationStatus(
    messageId: string,
    status: MessageModerationStatus,
  ): Promise<void> {
    if (!(await this.messaging.findMessage(messageId))) {
      throw new DomainError('MESSAGING_MESSAGE_NOT_FOUND', 'Message not found');
    }
    await this.messaging.updateMessage(messageId, { moderationStatus: status });
  }

  /**
   * Context of a message reported by a participant who sees the conversation: the message and
   * the REPORT_CONTEXT_MESSAGES_BEFORE messages before it, never the whole conversation; null
   * when the reporter may not see it.
   */
  async reportContext(
    messageId: string,
    reporterId: string,
  ): Promise<ReportedMessageContext | null> {
    const message = await this.messaging.findMessage(messageId);
    if (!message || message.deletedAt) return null;
    if (!(await this.access.find(reporterId, message.conversationId))) return null;
    const before = await this.messaging.messages(
      message.conversationId,
      { beforeSequence: message.sequence },
      REPORT_CONTEXT_MESSAGES_BEFORE,
    );
    const shown = [...before, message].sort((a, b) => a.sequence - b.sequence);
    return {
      conversationId: message.conversationId,
      senderId: message.senderId,
      messages: shown.map((item) => ({
        id: item.id,
        senderId: item.senderId,
        sentAt: item.createdAt,
        text: item.deletedAt ? null : item.body,
        reported: item.id === message.id,
      })),
    };
  }

  /** Unread messages and conversations of the inbox, without the conversations hidden by a block. */
  async unreadSummary(userId: string): Promise<{ messages: number; conversations: number }> {
    return this.messaging.unreadSummary(userId, await this.network.blockedUserIds(userId));
  }

  async pendingRequests(userId: string): Promise<number> {
    return this.messaging.countRequestsReceived(userId, await this.network.blockedUserIds(userId));
  }

  /** Introductions the member has still to answer. */
  introductionsAwaiting(userId: string): Promise<number> {
    return this.messaging.countIntroductionsAwaiting(userId);
  }

  /** Read state of a member in a conversation they see; null otherwise. */
  async unreadState(userId: string, conversationId: string): Promise<UnreadState | null> {
    const found = await this.access.find(userId, conversationId);
    return found
      ? {
          lastReadSequence: found.participant.lastReadSequence,
          lastSequence: found.conversation.lastSequence,
          muted: found.participant.muted,
        }
      : null;
  }

  /** Messages from the others after the read position, for the unread message email. */
  async unreadMessages(
    userId: string,
    conversationId: string,
    limit: number,
  ): Promise<UnreadMessage[]> {
    const found = await this.access.find(userId, conversationId);
    if (!found) return [];
    const records = await this.messaging.messages(
      conversationId,
      { afterSequence: found.participant.lastReadSequence },
      limit,
    );
    return records
      .filter((m) => m.senderId !== userId && !m.deletedAt && m.moderationStatus === 'visible')
      .map((m) => ({
        senderId: m.senderId,
        sequence: m.sequence,
        body: m.body,
        attachments: m.attachmentIds.length,
        createdAt: m.createdAt,
      }));
  }

  /** False while a message request waits for its recipient, or after its decline. */
  async isActive(conversationId: string): Promise<boolean> {
    return (await this.messaging.findConversation(conversationId))?.status === 'active';
  }

  async participantIds(conversationId: string): Promise<string[]> {
    return activeIds(await this.messaging.participants(conversationId));
  }
}

import { Injectable } from '@nestjs/common';
import type {
  Conversation,
  Introduction,
  MemberCard as MemberCardView,
  Message,
} from '@pitchorium/contracts';
import { ContentFacade } from '../../content';
import { MediaFacade } from '../../media';
import { type MemberCard, ProfilesFacade } from '../../profiles';
import {
  canSendIn,
  type MessageRecord,
  type ParticipantRecord,
  requestStateFor,
} from '../domain/conversation';
import { type IntroductionRecord, roleIn } from '../domain/introduction';
import type { ConversationListItem } from './ports';

export function cardView(card: MemberCard | undefined): MemberCardView | null {
  return card
    ? {
        handle: card.handle,
        displayName: card.displayName,
        headline: card.headline,
        avatarUrl: card.avatarUrl,
      }
    : null;
}

/**
 * Messages and conversations as one reader sees them: the sender card hidden across a block,
 * private attachments by short-lived URLs, a shared publication only when the reader may see
 * it (checked at each read), texts of deleted or moderated messages left out.
 */
@Injectable()
export class MessagingPresenter {
  constructor(
    private readonly profiles: ProfilesFacade,
    private readonly media: MediaFacade,
    private readonly content: ContentFacade,
  ) {}

  async messages(viewerId: string, records: readonly MessageRecord[]): Promise<Message[]> {
    if (records.length === 0) return [];
    const [cards, images, posts] = await Promise.all([
      this.profiles.memberCards([...new Set(records.map((m) => m.senderId))], viewerId),
      this.media.images(records.flatMap((m) => m.attachmentIds)),
      this.content.visiblePosts(
        viewerId,
        records.flatMap((m) => (m.sharedPostId && !m.deletedAt ? [m.sharedPostId] : [])),
      ),
    ]);
    return records.map((message) => {
      const hidden = message.deletedAt !== null || message.moderationStatus !== 'visible';
      return {
        id: message.id,
        conversationId: message.conversationId,
        sequence: message.sequence,
        clientMessageId: message.clientMessageId,
        kind: message.kind,
        senderHandle: cards.get(message.senderId)?.handle ?? null,
        mine: message.senderId === viewerId,
        body: hidden ? null : message.body,
        attachments: hidden
          ? []
          : message.attachmentIds.map((mediaId) => {
              const image = images.get(mediaId);
              return {
                mediaId,
                image: image ? { url: image.url, variants: image.variants } : null,
              };
            }),
        sharedPost:
          hidden || !message.sharedPostId
            ? null
            : { postId: message.sharedPostId, post: posts.get(message.sharedPostId) ?? null },
        edited: message.editedAt !== null,
        deleted: message.deletedAt !== null,
        moderationStatus: message.moderationStatus,
        createdAt: message.createdAt.toISOString(),
        editedAt: message.editedAt?.toISOString() ?? null,
      };
    });
  }

  async conversations(
    viewerId: string,
    items: readonly ConversationListItem[],
    participants: readonly ParticipantRecord[],
    lastMessages: ReadonlyMap<string, MessageRecord>,
    unread: ReadonlyMap<string, number>,
  ): Promise<Conversation[]> {
    const others = participants.filter((p) => p.participantId !== viewerId);
    const [cards, last] = await Promise.all([
      this.profiles.memberCards([...new Set(others.map((p) => p.participantId))], viewerId),
      this.messages(viewerId, [...lastMessages.values()]),
    ]);
    const lastById = new Map(last.map((message) => [message.conversationId, message]));
    return items.map(({ conversation, participant }) => ({
      id: conversation.id,
      kind: conversation.kind,
      requestState: requestStateFor(conversation, viewerId),
      participants: others
        .filter((p) => p.conversationId === conversation.id)
        .flatMap((p) => {
          const member = cardView(cards.get(p.participantId));
          return member
            ? [{ member, lastReadSequence: p.lastReadSequence, left: p.leftAt !== null }]
            : [];
        }),
      lastMessage: lastById.get(conversation.id) ?? null,
      lastSequence: conversation.lastSequence,
      lastReadSequence: participant.lastReadSequence,
      unreadCount: unread.get(conversation.id) ?? 0,
      markedUnread: participant.markedUnread,
      archived: participant.archivedAt !== null,
      muted: participant.muted,
      canSend: canSendIn(conversation, participant, viewerId),
      introductionId: conversation.introductionId,
      lastMessageAt: conversation.lastMessageAt.toISOString(),
      createdAt: conversation.createdAt.toISOString(),
    }));
  }

  async introductions(
    viewerId: string,
    records: readonly IntroductionRecord[],
  ): Promise<Introduction[]> {
    const cards = await this.profiles.memberCards(
      [...new Set(records.flatMap((r) => [r.introducerId, r.firstId, r.secondId]))],
      viewerId,
    );
    return records.map((record) => ({
      id: record.id,
      role: roleIn(record, viewerId) ?? 'introducer',
      introducer: cardView(cards.get(record.introducerId)),
      first: cardView(cards.get(record.firstId)),
      second: cardView(cards.get(record.secondId)),
      note: record.note,
      answers: { first: record.firstAnswer, second: record.secondAnswer },
      status: record.status,
      conversationId: record.conversationId,
      createdAt: record.createdAt.toISOString(),
    }));
  }
}

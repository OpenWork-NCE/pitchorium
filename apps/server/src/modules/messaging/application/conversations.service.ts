import { Inject, Injectable } from '@nestjs/common';
import type {
  Conversation,
  ConversationListQuery,
  CursorPage,
  Message,
  MessageListQuery,
  MessagePage,
  MessagePolicy,
  MessagingSettings,
  StartConversationRequest,
  UpdateConversationRequest,
} from '@pitchorium/contracts';
import { API_CONFIG, type ApiConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import {
  Clock,
  decodeKeyset,
  DomainError,
  encodeKeyset,
  IdGenerator,
} from '../../../platform/kernel';
import { ContentFacade } from '../../content';
import { IdentityFacade } from '../../identity';
import { MediaFacade } from '../../media';
import { NetworkFacade } from '../../network';
import { ProfilesFacade } from '../../profiles';
import {
  assertEditable,
  assertNotEmpty,
  type ConversationRecord,
  decideSend,
  decideStart,
  directKeyOf,
  MEMBER_PARTICIPANT,
  type MessageRecord,
  type ParticipantRecord,
} from '../domain/conversation';
import {
  ConversationCreated,
  ConversationRequestAccepted,
  ConversationRequestDeclined,
  MessageDeleted,
  MessageEdited,
  MessageSent,
} from '../domain/messaging-events';
import { activeIds, ConversationAccess, type VisibleConversation } from './conversation-access';
import { MESSAGE_RESOURCE } from './message-resource';
import { MessagingEventsRecorder } from './messaging-events.recorder';
import { MessagingPresenter } from './messaging-presenter';
import { MessagingRealtime } from './messaging-realtime';
import { MessagingRepository } from './ports';

const DAY_MS = 86_400_000;

export interface MessageContent {
  clientMessageId: string;
  body: string;
  attachmentIds: string[];
  sharedPostId?: string | undefined;
}

const active = activeIds;

/**
 * Conversations and messages (§10.4, ADR 0055 and 0056): who may write to whom, message
 * requests, numbered and deduplicated messages persisted before any push, read positions and
 * per-participant state, edit window and tombstones.
 */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly messaging: MessagingRepository,
    private readonly access: ConversationAccess,
    private readonly events: MessagingEventsRecorder,
    private readonly presenter: MessagingPresenter,
    private readonly realtime: MessagingRealtime,
    private readonly network: NetworkFacade,
    private readonly profiles: ProfilesFacade,
    private readonly identity: IdentityFacade,
    private readonly media: MediaFacade,
    private readonly content: ContentFacade,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  requireVisible(viewerId: string, conversationId: string): Promise<VisibleConversation> {
    return this.access.require(viewerId, conversationId);
  }

  async policyOf(userId: string): Promise<MessagePolicy> {
    return (await this.messaging.messagePolicy(userId)) ?? this.config.messaging.defaultPolicy;
  }

  async settings(userId: string): Promise<MessagingSettings> {
    return { messagePolicy: await this.policyOf(userId) };
  }

  async updateSettings(userId: string, settings: MessagingSettings): Promise<MessagingSettings> {
    await this.messaging.setMessagePolicy(userId, settings.messagePolicy, this.clock.now());
    return settings;
  }

  /** First message to a member: the direct conversation, created if needed. */
  async start(senderId: string, request: StartConversationRequest): Promise<Message> {
    const recipientId = await this.profiles.userIdOf(request.recipientHandle, senderId);
    if (!recipientId) throw new DomainError('MESSAGING_RECIPIENT_NOT_FOUND', 'Recipient not found');
    if (recipientId === senderId) {
      throw new DomainError('MESSAGING_SELF_CONVERSATION', 'A conversation needs another member');
    }
    const content = contentOf(request);
    assertNotEmpty(content);
    const key = directKeyOf(senderId, recipientId);
    const existing = await this.messaging.findDirect(key);
    if (existing) return this.send(senderId, existing.id, content);
    const duplicate = await this.duplicate(senderId, content);
    if (duplicate) return duplicate;

    const [degree, sender, policy] = await Promise.all([
      this.network.degreeBetween(senderId, recipientId),
      this.identity.findUser(senderId),
      this.policyOf(recipientId),
    ]);
    const decision = decideStart({
      degree,
      senderEmailVerified: sender?.emailVerified ?? false,
      recipientPolicy: policy,
    });
    if (decision.outcome === 'email_required') {
      throw new DomainError('ACCESS_PREREQUISITES_MISSING', 'A verified email is required', {
        missing: ['email_verified'],
      });
    }
    if (decision.outcome === 'refused') {
      throw new DomainError(decision.code, 'The recipient does not accept this message');
    }
    await this.assertSharedPost(senderId, content.sharedPostId);

    const created = await this.transactions.run(async () => {
      await this.messaging.lock(`messaging:direct:${key}`);
      if (await this.messaging.findDirect(key)) return null;
      const now = this.clock.now();
      const request = decision.outcome === 'request';
      if (request) {
        const since = new Date(now.getTime() - DAY_MS);
        const sent = await this.messaging.countRequestsSince(senderId, since);
        if (sent >= this.config.messaging.requestsPerDay) {
          throw new DomainError('MESSAGING_REQUEST_LIMIT', 'Too many message requests');
        }
      }
      const conversation: ConversationRecord = {
        id: this.ids.next(),
        kind: 'direct',
        directKey: key,
        status: request ? 'request' : 'active',
        requestedBy: request ? senderId : null,
        requestRecipientId: request ? recipientId : null,
        requestDecidedAt: null,
        introductionId: null,
        createdBy: senderId,
        lastSequence: 0,
        lastMessageAt: now,
        createdAt: now,
      };
      const participants = [senderId, recipientId].map((id) =>
        this.newParticipant(conversation.id, id, now),
      );
      await this.messaging.insertConversation(conversation);
      await this.messaging.insertParticipants(participants);
      await this.events.record(ConversationCreated, conversation.id, {
        kind: conversation.kind,
        status: conversation.status,
        createdBy: senderId,
        participantIds: [senderId, recipientId],
        introductionId: null,
      });
      const message = await this.append(conversation, participants, senderId, content, 'text');
      return { conversation, message };
    });
    // Created meanwhile by the other member: an ordinary send.
    if (!created) return this.send(senderId, (await this.messaging.findDirect(key))!.id, content);

    const { conversation, message } = created;
    this.realtime.conversation(
      conversation.id,
      conversation.status === 'request' ? 'request_received' : 'created',
      [recipientId],
    );
    await this.realtime.message('created', message, [senderId, recipientId]);
    return (await this.presenter.messages(senderId, [message]))[0]!;
  }

  /** Send in an existing conversation; a retried send with the same client id is answered once. */
  async send(senderId: string, conversationId: string, content: MessageContent): Promise<Message> {
    assertNotEmpty(content);
    const duplicate = await this.duplicate(senderId, content, conversationId);
    if (duplicate) return duplicate;
    const { conversation, participant, participants } = await this.requireVisible(
      senderId,
      conversationId,
    );
    const peerId =
      conversation.kind === 'direct'
        ? (participants.find((p) => p.participantId !== senderId)?.participantId ?? null)
        : null;
    const connectedNow =
      conversation.status !== 'active' && peerId !== null
        ? await this.network.areConnected(senderId, peerId)
        : false;
    const decision = decideSend(conversation, participant, senderId, connectedNow);
    if (decision.outcome === 'refused') {
      throw new DomainError(decision.code, 'Messages cannot be sent now');
    }
    await this.assertSharedPost(senderId, content.sharedPostId);

    const message = await this.transactions.run(async () => {
      await this.messaging.lock(`messaging:client:${senderId}:${content.clientMessageId}`);
      if (await this.messaging.findByClientId(senderId, content.clientMessageId)) return null;
      if (decision.outcome === 'accept_and_send') {
        await this.messaging.updateConversation(conversation.id, {
          status: 'active',
          requestDecidedAt: this.clock.now(),
        });
        await this.events.record(ConversationRequestAccepted, conversation.id, {
          requesterId: conversation.requestedBy ?? senderId,
          recipientId: conversation.requestRecipientId ?? senderId,
          reason: decision.reason,
        });
      }
      return this.append(conversation, participants, senderId, content, 'text');
    });
    if (!message) return (await this.duplicate(senderId, content, conversationId))!;

    const recipients = active(participants);
    if (decision.outcome === 'accept_and_send') {
      this.realtime.conversation(conversation.id, 'request_accepted', recipients);
    }
    await this.realtime.message('created', message, recipients);
    return (await this.presenter.messages(senderId, [message]))[0]!;
  }

  /**
   * Appends a message in the transaction: next sequence under the row lock of the conversation,
   * attachments, read position of the sender, unarchive, event.
   */
  async append(
    conversation: ConversationRecord,
    participants: readonly ParticipantRecord[],
    senderId: string,
    content: MessageContent,
    kind: MessageRecord['kind'],
  ): Promise<MessageRecord> {
    const now = this.clock.now();
    const sequence = await this.messaging.nextSequence(conversation.id, now);
    const message: MessageRecord = {
      id: this.ids.next(),
      conversationId: conversation.id,
      sequence,
      senderId,
      clientMessageId: content.clientMessageId,
      kind,
      body: content.body,
      attachmentIds: content.attachmentIds,
      sharedPostId: content.sharedPostId ?? null,
      moderationStatus: 'visible',
      createdAt: now,
      editedAt: null,
      deletedAt: null,
    };
    await this.messaging.insertMessage(message);
    for (const mediaId of content.attachmentIds) {
      await this.media.attach({
        mediaId,
        ownerId: senderId,
        usage: 'message_attachment',
        resource: { type: MESSAGE_RESOURCE, id: message.id },
        resourceVisibility: 'private',
      });
    }
    await this.messaging.advanceRead(conversation.id, senderId, sequence);
    await this.messaging.unarchive(conversation.id);
    await this.events.record(MessageSent, message.id, {
      conversationId: conversation.id,
      senderId,
      sequence,
      kind,
      recipientIds: active(participants).filter((id) => id !== senderId),
    });
    return message;
  }

  async list(viewerId: string, query: ConversationListQuery): Promise<CursorPage<Conversation>> {
    const hidden = await this.network.blockedUserIds(viewerId);
    const items = await this.messaging.conversations(
      viewerId,
      query.box,
      hidden,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = items.slice(0, query.limit);
    const ids = page.map((item) => item.conversation.id);
    const [participants, last, unread] = await Promise.all([
      this.messaging.participantsOf(ids),
      this.messaging.lastMessages(ids),
      this.messaging.unreadCounts(viewerId, ids),
    ]);
    const lastItem = page.at(-1);
    return {
      items: await this.presenter.conversations(viewerId, page, participants, last, unread),
      nextCursor:
        items.length > query.limit && lastItem
          ? encodeKeyset({
              at: lastItem.conversation.lastMessageAt,
              key: lastItem.conversation.id,
            })
          : null,
    };
  }

  async get(viewerId: string, conversationId: string): Promise<Conversation> {
    const { conversation, participant, participants } = await this.requireVisible(
      viewerId,
      conversationId,
    );
    const [last, unread] = await Promise.all([
      this.messaging.lastMessages([conversationId]),
      this.messaging.unreadCounts(viewerId, [conversationId]),
    ]);
    const [presented] = await this.presenter.conversations(
      viewerId,
      [{ conversation, participant }],
      participants,
      last,
      unread,
    );
    return presented!;
  }

  /** History before a sequence, or the messages after one (sync after reconnection). */
  async messages(
    viewerId: string,
    conversationId: string,
    query: MessageListQuery,
  ): Promise<MessagePage> {
    const { conversation } = await this.requireVisible(viewerId, conversationId);
    const range =
      query.afterSequence !== undefined
        ? { afterSequence: query.afterSequence }
        : { beforeSequence: query.beforeSequence ?? conversation.lastSequence + 1 };
    const records = await this.messaging.messages(conversationId, range, query.limit + 1);
    const hasMore = records.length > query.limit;
    // Ascending order; a history page keeps the most recent of the fetched messages.
    const page =
      range.afterSequence !== undefined
        ? records.slice(0, query.limit)
        : records.slice(Math.max(0, records.length - query.limit));
    return {
      items: await this.presenter.messages(viewerId, page),
      lastSequence: conversation.lastSequence,
      hasMore,
    };
  }

  /** Read receipt: the read position only moves forward, and every device hears of it. */
  async read(
    viewerId: string,
    conversationId: string,
    sequence: number,
  ): Promise<{ sequence: number }> {
    const { conversation, participants } = await this.requireVisible(viewerId, conversationId);
    const target = Math.min(sequence, conversation.lastSequence);
    const kept = await this.transactions.run(async () => {
      const position = await this.messaging.advanceRead(conversationId, viewerId, target);
      await this.messaging.updateParticipant(conversationId, viewerId, { markedUnread: false });
      return position;
    });
    await this.realtime.read(conversationId, viewerId, kept, active(participants));
    return { sequence: kept };
  }

  async update(
    viewerId: string,
    conversationId: string,
    request: UpdateConversationRequest,
  ): Promise<Conversation> {
    await this.requireVisible(viewerId, conversationId);
    const now = this.clock.now();
    await this.messaging.updateParticipant(conversationId, viewerId, {
      ...(request.archived !== undefined ? { archivedAt: request.archived ? now : null } : {}),
      ...(request.muted !== undefined ? { muted: request.muted } : {}),
      ...(request.unread !== undefined ? { markedUnread: request.unread } : {}),
    });
    this.realtime.conversation(conversationId, 'state_changed', [viewerId]);
    return this.get(viewerId, conversationId);
  }

  /** A participant leaves a group conversation (an introducer once the others met). */
  async leave(viewerId: string, conversationId: string): Promise<void> {
    const { conversation, participants } = await this.requireVisible(viewerId, conversationId);
    if (conversation.kind !== 'group') {
      throw new DomainError('MESSAGING_NOT_A_GROUP', 'Only a group conversation can be left');
    }
    await this.messaging.updateParticipant(conversationId, viewerId, { leftAt: this.clock.now() });
    this.realtime.conversation(conversationId, 'participant_left', active(participants));
  }

  /** The recipient accepts or declines a request; a decline stays silent for the sender. */
  async respond(recipientId: string, conversationId: string, accept: boolean): Promise<void> {
    const conversation = await this.messaging.findConversation(conversationId);
    if (conversation?.status !== 'request' || conversation.requestRecipientId !== recipientId) {
      throw new DomainError('MESSAGING_REQUEST_NOT_FOUND', 'Message request not found');
    }
    const requesterId = conversation.requestedBy ?? '';
    await this.transactions.run(async () => {
      await this.messaging.updateConversation(conversationId, {
        status: accept ? 'active' : 'declined',
        requestDecidedAt: this.clock.now(),
      });
      await (accept
        ? this.events.record(ConversationRequestAccepted, conversationId, {
            requesterId,
            recipientId,
            reason: 'answer',
          })
        : this.events.record(ConversationRequestDeclined, conversationId, {
            requesterId,
            recipientId,
          }));
    });
    this.realtime.conversation(
      conversationId,
      accept ? 'request_accepted' : 'state_changed',
      accept ? [requesterId, recipientId] : [recipientId],
    );
  }

  async edit(
    editorId: string,
    conversationId: string,
    messageId: string,
    body: string,
  ): Promise<Message> {
    const { participants } = await this.requireVisible(editorId, conversationId);
    const message = await this.messageOf(conversationId, messageId);
    assertEditable(message, editorId, this.clock.now(), this.config.messaging.editWindowMs);
    const edited = { ...message, body, editedAt: this.clock.now() };
    await this.transactions.run(async () => {
      await this.messaging.updateMessage(messageId, { body, editedAt: edited.editedAt });
      await this.events.record(MessageEdited, messageId, {
        conversationId,
        senderId: editorId,
        sequence: message.sequence,
      });
    });
    await this.realtime.message('updated', edited, active(participants));
    return (await this.presenter.messages(editorId, [edited]))[0]!;
  }

  /** Deletion leaves a tombstone: the sequence stays, the content and the files go. */
  async delete(userId: string, conversationId: string, messageId: string): Promise<void> {
    const { participants } = await this.requireVisible(userId, conversationId);
    const message = await this.messageOf(conversationId, messageId);
    if (message.senderId !== userId) {
      throw new DomainError('MESSAGING_NOT_SENDER', 'Only the sender may delete the message');
    }
    if (message.deletedAt) return;
    const deletedAt = this.clock.now();
    await this.transactions.run(async () => {
      await this.messaging.updateMessage(messageId, {
        body: '',
        attachmentIds: [],
        sharedPostId: null,
        deletedAt,
      });
      for (const mediaId of message.attachmentIds) await this.media.detach(mediaId);
      await this.events.record(MessageDeleted, messageId, {
        conversationId,
        senderId: userId,
        sequence: message.sequence,
      });
    });
    await this.realtime.message(
      'updated',
      { ...message, body: '', attachmentIds: [], sharedPostId: null, deletedAt },
      active(participants),
    );
  }

  /** Typing indicator: relayed to the other participants, never stored. */
  async typing(userId: string, conversationId: string): Promise<void> {
    const { participants } = await this.requireVisible(userId, conversationId);
    const card = (await this.profiles.memberCards([userId])).get(userId);
    if (!card) return;
    this.realtime.typing(
      conversationId,
      card.handle,
      active(participants).filter((id) => id !== userId),
    );
  }

  async messageOf(conversationId: string, messageId: string): Promise<MessageRecord> {
    const message = await this.messaging.findMessage(messageId);
    if (message?.conversationId !== conversationId) {
      throw new DomainError('MESSAGING_MESSAGE_NOT_FOUND', 'Message not found');
    }
    return message;
  }

  newParticipant(conversationId: string, userId: string, now: Date): ParticipantRecord {
    return {
      conversationId,
      participantType: MEMBER_PARTICIPANT,
      participantId: userId,
      lastReadSequence: 0,
      markedUnread: false,
      archivedAt: null,
      muted: false,
      joinedAt: now,
      leftAt: null,
    };
  }

  /** The message already sent with this client id, when the same content is sent again. */
  private async duplicate(
    senderId: string,
    content: MessageContent,
    conversationId?: string,
  ): Promise<Message | null> {
    const existing = await this.messaging.findByClientId(senderId, content.clientMessageId);
    if (!existing) return null;
    const same =
      (conversationId === undefined || existing.conversationId === conversationId) &&
      (existing.deletedAt !== null ||
        (existing.body === content.body &&
          existing.attachmentIds.join() === content.attachmentIds.join() &&
          existing.sharedPostId === (content.sharedPostId ?? null)));
    if (!same) {
      throw new DomainError('MESSAGING_CLIENT_ID_REUSED', 'Client message id already used');
    }
    return (await this.presenter.messages(senderId, [existing]))[0]!;
  }

  private async assertSharedPost(viewerId: string, postId: string | undefined): Promise<void> {
    if (postId && !(await this.content.visiblePosts(viewerId, [postId])).has(postId)) {
      throw new DomainError('MESSAGING_SHARED_POST_NOT_FOUND', 'Shared publication not found');
    }
  }
}

function contentOf(request: StartConversationRequest): MessageContent {
  return {
    clientMessageId: request.clientMessageId,
    body: request.body,
    attachmentIds: request.attachmentIds,
    sharedPostId: request.sharedPostId,
  };
}

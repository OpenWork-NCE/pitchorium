import { Injectable } from '@nestjs/common';
import type {
  CursorPage,
  CursorPageQuery,
  Introduction,
  ProposeIntroductionRequest,
} from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import {
  Clock,
  decodeKeyset,
  DomainError,
  encodeKeyset,
  IdGenerator,
} from '../../../platform/kernel';
import { NetworkFacade } from '../../network';
import { ProfilesFacade } from '../../profiles';
import type { ConversationRecord } from '../domain/conversation';
import {
  answer,
  assertIntroducible,
  type IntroductionRecord,
  roleIn,
} from '../domain/introduction';
import {
  ConversationCreated,
  IntroductionAccepted,
  IntroductionCompleted,
  IntroductionDeclined,
  IntroductionProposed,
} from '../domain/messaging-events';
import { ConversationsService } from './conversations.service';
import { MessagingEventsRecorder } from './messaging-events.recorder';
import { MessagingPresenter } from './messaging-presenter';
import { MessagingRealtime } from './messaging-realtime';
import { MessagingRepository } from './ports';

const notFound = () =>
  new DomainError('MESSAGING_INTRODUCTION_NOT_FOUND', 'Introduction not found');

/**
 * Introductions (ADR 0058): A, connected to B and C, introduces them with a note; each answers;
 * two acceptances open a group conversation of the three, whose first message is the note.
 */
@Injectable()
export class IntroductionsService {
  constructor(
    private readonly messaging: MessagingRepository,
    private readonly conversations: ConversationsService,
    private readonly events: MessagingEventsRecorder,
    private readonly presenter: MessagingPresenter,
    private readonly realtime: MessagingRealtime,
    private readonly network: NetworkFacade,
    private readonly profiles: ProfilesFacade,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async propose(introducerId: string, request: ProposeIntroductionRequest): Promise<Introduction> {
    const [firstId, secondId] = await Promise.all([
      this.profiles.userIdOf(request.firstHandle, introducerId),
      this.profiles.userIdOf(request.secondHandle, introducerId),
    ]);
    if (!firstId || !secondId) {
      throw new DomainError('MESSAGING_RECIPIENT_NOT_FOUND', 'Member not found');
    }
    const [connectedToFirst, connectedToSecond] = await Promise.all([
      this.network.areConnected(introducerId, firstId),
      this.network.areConnected(introducerId, secondId),
    ]);
    assertIntroducible({ introducerId, firstId, secondId, connectedToFirst, connectedToSecond });
    // Two members across a block are never brought together.
    if (await this.network.isBlockedBetween(firstId, secondId)) {
      throw new DomainError('MESSAGING_INTRODUCTION_INVALID', 'These members cannot be introduced');
    }
    const record: IntroductionRecord = {
      id: this.ids.next(),
      introducerId,
      firstId,
      secondId,
      note: request.note,
      firstAnswer: 'pending',
      secondAnswer: 'pending',
      status: 'pending',
      conversationId: null,
      createdAt: this.clock.now(),
      decidedAt: null,
    };
    await this.transactions.run(async () => {
      if (!(await this.messaging.insertIntroduction(record))) {
        throw new DomainError('MESSAGING_INTRODUCTION_PENDING', 'Introduction already pending');
      }
      await this.events.record(IntroductionProposed, record.id, {
        introducerId,
        firstId,
        secondId,
      });
    });
    return (await this.presenter.introductions(introducerId, [record]))[0]!;
  }

  /** The introduction as one of its three members sees it; 404 for anyone else. */
  async get(viewerId: string, introductionId: string): Promise<Introduction> {
    const record = await this.messaging.findIntroduction(introductionId);
    if (!record || !roleIn(record, viewerId)) throw notFound();
    return (await this.presenter.introductions(viewerId, [record]))[0]!;
  }

  async list(viewerId: string, query: CursorPageQuery): Promise<CursorPage<Introduction>> {
    const records = await this.messaging.introductions(
      viewerId,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = records.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: await this.presenter.introductions(viewerId, page),
      nextCursor:
        records.length > query.limit && last
          ? encodeKeyset({ at: last.createdAt, key: last.id })
          : null,
    };
  }

  async respond(userId: string, introductionId: string, accepted: boolean): Promise<Introduction> {
    const result = await this.transactions.run(async () => {
      const record = await this.messaging.lockIntroduction(introductionId);
      const role = record ? roleIn(record, userId) : null;
      if (!record || (role !== 'first' && role !== 'second')) throw notFound();
      const answered = answer(record, role, accepted);
      const now = this.clock.now();
      const parties = {
        introducerId: record.introducerId,
        firstId: record.firstId,
        secondId: record.secondId,
      };
      let opened: { conversation: ConversationRecord; messageId: string } | null = null;
      if (answered.outcome === 'completed') {
        opened = await this.openGroup(record, now);
      }
      const updated: IntroductionRecord = {
        ...record,
        firstAnswer: answered.firstAnswer,
        secondAnswer: answered.secondAnswer,
        status:
          answered.outcome === 'waiting'
            ? 'pending'
            : answered.outcome === 'completed'
              ? 'completed'
              : 'declined',
        conversationId: opened?.conversation.id ?? null,
        decidedAt: answered.outcome === 'waiting' ? null : now,
      };
      await this.messaging.updateIntroduction(introductionId, {
        firstAnswer: updated.firstAnswer,
        secondAnswer: updated.secondAnswer,
        status: updated.status,
        conversationId: updated.conversationId,
        decidedAt: updated.decidedAt,
      });
      if (answered.outcome === 'declined') {
        await this.events.record(IntroductionDeclined, introductionId, { ...parties, by: userId });
      } else {
        await this.events.record(IntroductionAccepted, introductionId, { ...parties, by: userId });
      }
      if (opened) {
        await this.events.record(IntroductionCompleted, introductionId, {
          ...parties,
          conversationId: opened.conversation.id,
        });
      }
      return { updated, opened };
    });
    if (result.opened) {
      const members = [
        result.updated.introducerId,
        result.updated.firstId,
        result.updated.secondId,
      ];
      this.realtime.conversation(result.opened.conversation.id, 'created', members);
      const message = await this.messaging.findMessage(result.opened.messageId);
      if (message) await this.realtime.message('created', message, members);
    }
    return (await this.presenter.introductions(userId, [result.updated]))[0]!;
  }

  /** The group of the three, with the note of the introducer as first message. */
  private async openGroup(
    record: IntroductionRecord,
    now: Date,
  ): Promise<{ conversation: ConversationRecord; messageId: string }> {
    const conversation: ConversationRecord = {
      id: this.ids.next(),
      kind: 'group',
      directKey: null,
      status: 'active',
      requestedBy: null,
      requestRecipientId: null,
      requestDecidedAt: null,
      introductionId: record.id,
      createdBy: record.introducerId,
      lastSequence: 0,
      lastMessageAt: now,
      createdAt: now,
    };
    const memberIds = [record.introducerId, record.firstId, record.secondId];
    const participants = memberIds.map((id) =>
      this.conversations.newParticipant(conversation.id, id, now),
    );
    await this.messaging.insertConversation(conversation);
    await this.messaging.insertParticipants(participants);
    await this.events.record(ConversationCreated, conversation.id, {
      kind: 'group',
      status: 'active',
      createdBy: record.introducerId,
      participantIds: memberIds,
      introductionId: record.id,
    });
    const message = await this.conversations.append(
      conversation,
      participants,
      record.introducerId,
      { clientMessageId: `introduction-${record.id}`, body: record.note, attachmentIds: [] },
      'introduction',
    );
    return { conversation, messageId: message.id };
  }
}

import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import {
  CLIENT_EVENTS,
  type ErrorCode,
  type Message,
  type MessagePage,
  socketReadSchema,
  socketSendSchema,
  socketSyncSchema,
  socketTypingSchema,
} from '@pitchorium/contracts';
import type { Socket } from 'socket.io';
import type { z } from 'zod';
import { DomainError } from '../../../platform/kernel';
import {
  MEMBERS_NAMESPACE,
  type SocketPrincipal,
  socketPrincipal,
} from '../../../platform/realtime';
import { IdentityFacade } from '../../identity';
import { ConversationsService } from '../application/conversations.service';

type Ack<T> = { ok: true; result: T } | { ok: false; code: ErrorCode };

/** Typing indicators of one socket and conversation are relayed at most this often. */
const TYPING_INTERVAL_MS = 2000;

/**
 * Messaging events of the members namespace (docs/architecture/realtime.md): send, sync after
 * reconnection and read receipts answered by an acknowledgement, typing relayed without
 * storage. The same rules as the HTTP routes apply: participation, blocks, accepted terms.
 */
@WebSocketGateway({ namespace: MEMBERS_NAMESPACE })
export class MessagingGateway {
  private readonly logger = new Logger(MessagingGateway.name);
  private readonly typingAt = new WeakMap<Socket, Map<string, number>>();

  constructor(
    private readonly conversations: ConversationsService,
    private readonly identity: IdentityFacade,
  ) {}

  @SubscribeMessage(CLIENT_EVENTS.send)
  send(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<Ack<Message>> {
    return this.answer(socket, socketSendSchema, body, async (principal, data) => {
      await this.assertTermsAccepted(principal.userId);
      return this.conversations.send(principal.userId, data.conversationId, {
        clientMessageId: data.clientMessageId,
        body: data.body,
        attachmentIds: data.attachmentIds,
        sharedPostId: data.sharedPostId,
      });
    });
  }

  @SubscribeMessage(CLIENT_EVENTS.sync)
  sync(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<Ack<MessagePage>> {
    return this.answer(socket, socketSyncSchema, body, (principal, data) =>
      this.conversations.messages(principal.userId, data.conversationId, {
        afterSequence: data.afterSequence,
        limit: data.limit,
      }),
    );
  }

  @SubscribeMessage(CLIENT_EVENTS.read)
  read(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: unknown,
  ): Promise<Ack<{ sequence: number }>> {
    return this.answer(socket, socketReadSchema, body, (principal, data) =>
      this.conversations.read(principal.userId, data.conversationId, data.sequence),
    );
  }

  @SubscribeMessage(CLIENT_EVENTS.typing)
  async typing(@ConnectedSocket() socket: Socket, @MessageBody() body: unknown): Promise<void> {
    const principal = socketPrincipal(socket);
    const parsed = socketTypingSchema.safeParse(body);
    if (!principal || !parsed.success) return;
    const seen = this.typingAt.get(socket) ?? new Map<string, number>();
    this.typingAt.set(socket, seen);
    const now = Date.now();
    if (now - (seen.get(parsed.data.conversationId) ?? 0) < TYPING_INTERVAL_MS) return;
    seen.set(parsed.data.conversationId, now);
    await this.conversations.typing(principal.userId, parsed.data.conversationId).catch(() => {
      // A typing indicator for a conversation the member does not see is ignored.
    });
  }

  private async answer<S extends z.ZodType, T>(
    socket: Socket,
    schema: S,
    body: unknown,
    work: (principal: SocketPrincipal, data: z.infer<S>) => Promise<T>,
  ): Promise<Ack<T>> {
    const principal = socketPrincipal(socket);
    if (!principal) return { ok: false, code: 'UNAUTHENTICATED' };
    const parsed = schema.safeParse(body);
    if (!parsed.success) return { ok: false, code: 'VALIDATION_FAILED' };
    try {
      return { ok: true, result: await work(principal, parsed.data) };
    } catch (error) {
      if (error instanceof DomainError) return { ok: false, code: error.code };
      this.logger.error(error);
      return { ok: false, code: 'INTERNAL_ERROR' };
    }
  }

  private async assertTermsAccepted(userId: string): Promise<void> {
    const user = await this.identity.findUser(userId);
    if (!user || !this.identity.legalStatus(user).upToDate) {
      throw new DomainError('ACCESS_PREREQUISITES_MISSING', 'Terms to accept', {
        missing: ['legal_acceptance'],
      });
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { type ConversationChange, SERVER_EVENTS } from '@pitchorium/contracts';
import { RealtimePublisher } from '../../../platform/realtime';
import { ProfilesFacade } from '../../profiles';
import type { MessageRecord } from '../domain/conversation';
import { MessagingPresenter } from './messaging-presenter';

/**
 * Pushes after the commit, never before (ADR 0056): a lost push is caught up by the sequence
 * (`messaging:sync`). Each recipient gets the message as they may see it.
 */
@Injectable()
export class MessagingRealtime {
  private readonly logger = new Logger(MessagingRealtime.name);

  constructor(
    private readonly publisher: RealtimePublisher,
    private readonly presenter: MessagingPresenter,
    private readonly profiles: ProfilesFacade,
  ) {}

  async message(
    kind: 'created' | 'updated',
    message: MessageRecord,
    userIds: readonly string[],
  ): Promise<void> {
    const event = kind === 'created' ? SERVER_EVENTS.message : SERVER_EVENTS.messageUpdated;
    await this.safely(event, async () => {
      for (const userId of new Set(userIds)) {
        const [presented] = await this.presenter.messages(userId, [message]);
        this.publisher.toUsers([userId], event, { message: presented });
      }
    });
  }

  async read(
    conversationId: string,
    readerId: string,
    sequence: number,
    userIds: readonly string[],
  ): Promise<void> {
    await this.safely(SERVER_EVENTS.read, async () => {
      for (const userId of new Set(userIds)) {
        const handle =
          userId === readerId
            ? null
            : ((await this.profiles.memberCards([readerId], userId)).get(readerId)?.handle ?? null);
        this.publisher.toUsers([userId], SERVER_EVENTS.read, {
          conversationId,
          handle,
          mine: userId === readerId,
          sequence,
        });
      }
    });
  }

  typing(conversationId: string, handle: string, userIds: readonly string[]): void {
    this.publisher.toUsers(userIds, SERVER_EVENTS.typing, { conversationId, handle });
  }

  conversation(
    conversationId: string,
    change: ConversationChange,
    userIds: readonly string[],
  ): void {
    this.publisher.toUsers(userIds, SERVER_EVENTS.conversation, { conversationId, change });
  }

  private async safely(event: string, push: () => Promise<void>): Promise<void> {
    try {
      await push();
    } catch (error) {
      this.logger.warn(`Realtime ${event} failed: ${(error as Error).message}`);
    }
  }
}

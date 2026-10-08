import { Injectable, type OnModuleInit } from '@nestjs/common';
import { eq, or, sql } from '@pitchorium/db/orm';
import {
  messagingIntroductions,
  messagingMessages,
  messagingParticipants,
  messagingSettings,
} from '@pitchorium/db/schemas/messaging';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';

/**
 * Personal data of messaging: the messages the member wrote, their conversations and
 * introductions, their setting. Conversations belong to the other participants too: the
 * messages of the member become tombstones (empty, without files) whose sender is the
 * pseudonym, shown as « Membre supprimé ».
 */
@Injectable()
export class MessagingPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'messaging',
      description:
        'The messages you wrote, the conversations you take part in, the introductions you proposed or received, and your messaging preference.',
      order: ERASURE_ORDER.contents,
      exporter: {
        export: async (userId) => ({
          data: {
            messagesSent: await this.db
              .select({
                id: messagingMessages.id,
                conversationId: messagingMessages.conversationId,
                body: messagingMessages.body,
                attachmentIds: messagingMessages.attachmentIds,
                sharedPostId: messagingMessages.sharedPostId,
                createdAt: messagingMessages.createdAt,
                editedAt: messagingMessages.editedAt,
                deletedAt: messagingMessages.deletedAt,
              })
              .from(messagingMessages)
              .where(eq(messagingMessages.senderId, userId)),
            conversations: await this.db
              .select()
              .from(messagingParticipants)
              .where(eq(messagingParticipants.participantId, userId)),
            introductions: await this.db
              .select()
              .from(messagingIntroductions)
              .where(
                or(
                  eq(messagingIntroductions.introducerId, userId),
                  eq(messagingIntroductions.firstId, userId),
                  eq(messagingIntroductions.secondId, userId),
                ),
              ),
            settings: await this.db
              .select()
              .from(messagingSettings)
              .where(eq(messagingSettings.userId, userId)),
          },
        }),
      },
      eraser: {
        erase: async ({ userId, pseudonym }) => {
          const db = this.db;
          await db
            .update(messagingMessages)
            .set({
              body: '',
              attachmentIds: [],
              sharedPostId: null,
              deletedAt: sql`coalesce(${messagingMessages.deletedAt}, ${this.clock.now()})`,
            })
            .where(eq(messagingMessages.senderId, userId));
          await db
            .update(messagingIntroductions)
            .set({ note: '' })
            .where(eq(messagingIntroductions.introducerId, userId));
          await db.delete(messagingSettings).where(eq(messagingSettings.userId, userId));
          await replaceIdentifier(
            db,
            [
              { table: 'messaging.messages', column: 'sender_id' },
              { table: 'messaging.participants', column: 'participant_id' },
              { table: 'messaging.conversations', column: 'created_by' },
              { table: 'messaging.conversations', column: 'requested_by' },
              { table: 'messaging.conversations', column: 'request_recipient_id' },
              { table: 'messaging.conversations', column: 'direct_key', kind: 'text' },
              { table: 'messaging.introductions', column: 'introducer_id' },
              { table: 'messaging.introductions', column: 'first_id' },
              { table: 'messaging.introductions', column: 'second_id' },
            ],
            userId,
            pseudonym,
          );
        },
      },
    });
  }
}

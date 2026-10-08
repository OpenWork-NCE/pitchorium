import { Injectable, type OnModuleInit } from '@nestjs/common';
import { eq, sql } from '@pitchorium/db/orm';
import {
  notificationsDeliveries,
  notificationsNotifications,
  notificationsPreferences,
  notificationsSettings,
  notificationsSuppressions,
  notificationsUnreadMessageEmails,
} from '@pitchorium/db/schemas/notifications';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';
import { suppressionFingerprint } from './drizzle-notifications.repository';

/**
 * Personal data of notifications: the notifications received, preferences and digest setting.
 * The erasure deletes them, replaces the member among the actors of the notifications of
 * others by the pseudonym, and keeps of a suppressed address only its fingerprint, so that a
 * bounce or a complaint is still honored (ADR 0075).
 */
@Injectable()
export class NotificationsPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly transactions: TransactionManager,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'notifications',
      description:
        'The notifications you received, your preferences by type and channel, and your email digest setting.',
      order: ERASURE_ORDER.activity,
      exporter: {
        export: async (userId) => ({
          data: {
            notifications: await this.db
              .select()
              .from(notificationsNotifications)
              .where(eq(notificationsNotifications.recipientId, userId)),
            preferences: await this.db
              .select()
              .from(notificationsPreferences)
              .where(eq(notificationsPreferences.userId, userId)),
            settings: await this.db
              .select()
              .from(notificationsSettings)
              .where(eq(notificationsSettings.userId, userId)),
          },
        }),
      },
      eraser: {
        erase: async ({ userId, email, pseudonym }) => {
          const db = this.db;
          await db
            .delete(notificationsDeliveries)
            .where(eq(notificationsDeliveries.recipientId, userId));
          await db
            .delete(notificationsNotifications)
            .where(eq(notificationsNotifications.recipientId, userId));
          await db
            .delete(notificationsPreferences)
            .where(eq(notificationsPreferences.userId, userId));
          await db.delete(notificationsSettings).where(eq(notificationsSettings.userId, userId));
          await db
            .delete(notificationsUnreadMessageEmails)
            .where(eq(notificationsUnreadMessageEmails.recipientId, userId));
          await replaceIdentifier(
            db,
            [
              { table: 'notifications.notifications', column: 'actor_ids', kind: 'uuid[]' },
              { table: 'notifications.notifications', column: 'data', kind: 'jsonb' },
              { table: 'notifications.notifications', column: 'target_id', kind: 'text' },
            ],
            userId,
            pseudonym,
          );
          await db
            .update(notificationsSuppressions)
            .set({ email: suppressionFingerprint(email) })
            .where(sql`${notificationsSuppressions.email} = ${email.trim().toLowerCase()}`);
        },
      },
    });
  }
}

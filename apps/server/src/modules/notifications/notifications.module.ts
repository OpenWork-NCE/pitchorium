import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { NotificationCreator } from './application/notification-creator';
import { NotificationsFacade } from './application/notifications.facade';
import { NotificationsRepository } from './application/ports';
import { DrizzleNotificationsRepository } from './infrastructure/drizzle-notifications.repository';

const SHARED_PROVIDERS: Provider[] = [
  { provide: NotificationsRepository, useClass: DrizzleNotificationsRepository },
  NotificationCreator,
  NotificationsFacade,
];

/**
 * Notifications (§10.5): in-app and email, grouped, with preferences, digests, unread message
 * emails and deliverability. They react to the events of the other modules (worker).
 */
@Module({})
export class NotificationsModule {
  static forApi(): DynamicModule {
    return {
      module: NotificationsModule,
      providers: SHARED_PROVIDERS,
      exports: [NotificationsFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: NotificationsModule,
      providers: SHARED_PROVIDERS,
      exports: [NotificationsFacade],
    };
  }
}

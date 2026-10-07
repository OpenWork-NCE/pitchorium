import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { CountersService } from './application/counters.service';
import { EmailLinks } from './application/email-links';
import {
  EmailChannel,
  InAppChannel,
  NOTIFICATION_CHANNEL_ADAPTERS,
  type NotificationChannelAdapter,
} from './application/notification-channels';
import { NotificationCreator } from './application/notification-creator';
import { NotificationEmailsService } from './application/notification-emails.service';
import { NotificationPresenter } from './application/notification-presenter';
import { NotificationReadsService } from './application/notification-reads.service';
import { NotificationSources } from './application/notification-sources';
import { NotificationsFacade } from './application/notifications.facade';
import { NotificationsMaintenanceService } from './application/notifications-maintenance.service';
import { NotificationsRepository } from './application/ports';
import { DrizzleNotificationsRepository } from './infrastructure/drizzle-notifications.repository';
import {
  NotificationDeliveryHandler,
  NotificationSourcesHandler,
} from './interface/notification-events.handlers';
import { NotificationsController } from './interface/notifications.controller';
import { NotificationsJobsProcessor } from './interface/notifications-jobs.processor';
import { NOTIFICATIONS_QUEUE } from './interface/notifications-queue';

const SHARED_PROVIDERS: Provider[] = [
  { provide: NotificationsRepository, useClass: DrizzleNotificationsRepository },
  NotificationCreator,
  NotificationPresenter,
  CountersService,
  EmailLinks,
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
      controllers: [NotificationsController],
      providers: [...SHARED_PROVIDERS, NotificationReadsService],
      exports: [NotificationsFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: NotificationsModule,
      imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
      providers: [
        ...SHARED_PROVIDERS,
        NotificationSources,
        NotificationEmailsService,
        NotificationsMaintenanceService,
        InAppChannel,
        EmailChannel,
        {
          // Enabled channels; a push channel would be added here (ADR 0060).
          provide: NOTIFICATION_CHANNEL_ADAPTERS,
          inject: [InAppChannel, EmailChannel],
          useFactory: (...channels: NotificationChannelAdapter[]) => channels,
        },
        NotificationSourcesHandler,
        NotificationDeliveryHandler,
        NotificationsJobsProcessor,
      ],
      exports: [NotificationsFacade],
    };
  }
}

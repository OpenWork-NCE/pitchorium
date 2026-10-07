import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { ConversationAccess } from './application/conversation-access';
import { ConversationsService } from './application/conversations.service';
import { MessagingEventsRecorder } from './application/messaging-events.recorder';
import { MessagingPresenter } from './application/messaging-presenter';
import { MessagingRealtime } from './application/messaging-realtime';
import { MessagingFacade } from './application/messaging.facade';
import { MessagingRepository } from './application/ports';
import { DrizzleMessagingRepository } from './infrastructure/drizzle-messaging.repository';
import {
  ConversationResolver,
  MessageResolver,
  MessagingController,
  RequestResolver,
} from './interface/messaging.controller';
import { MessagingGateway } from './interface/messaging.gateway';

const SHARED_PROVIDERS: Provider[] = [
  { provide: MessagingRepository, useClass: DrizzleMessagingRepository },
  ConversationAccess,
  MessagingFacade,
];

/**
 * Messaging (§10.4): conversations, requests, introductions, realtime. Global so that the
 * notifications and trust modules can inject MessagingFacade; imports go through index.ts.
 */
@Module({})
export class MessagingModule {
  static forApi(): DynamicModule {
    return {
      module: MessagingModule,
      global: true,
      controllers: [MessagingController],
      providers: [
        ...SHARED_PROVIDERS,
        MessagingEventsRecorder,
        MessagingPresenter,
        MessagingRealtime,
        ConversationsService,
        MessagingGateway,
        ConversationResolver,
        MessageResolver,
        RequestResolver,
      ],
      exports: [MessagingFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: MessagingModule,
      global: true,
      providers: SHARED_PROVIDERS,
      exports: [MessagingFacade],
    };
  }
}

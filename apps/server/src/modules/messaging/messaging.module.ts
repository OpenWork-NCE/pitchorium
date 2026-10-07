import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { ConversationAccess } from './application/conversation-access';
import { MessagingFacade } from './application/messaging.facade';
import { MessagingRepository } from './application/ports';
import { DrizzleMessagingRepository } from './infrastructure/drizzle-messaging.repository';

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
      providers: SHARED_PROVIDERS,
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

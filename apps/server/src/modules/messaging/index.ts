/** Public facade of the messaging module: the only file other modules may import. */
export {
  MessagingFacade,
  type UnreadMessage,
  type UnreadState,
} from './application/messaging.facade';
export {
  ConversationCreated,
  ConversationRequestAccepted,
  ConversationRequestDeclined,
  IntroductionAccepted,
  IntroductionCompleted,
  IntroductionDeclined,
  IntroductionProposed,
  MessageDeleted,
  MessageEdited,
  MessageSent,
} from './domain/messaging-events';
export { MessagingModule } from './messaging.module';

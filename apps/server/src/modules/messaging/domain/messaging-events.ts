import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

/** Messaging events: identifiers and codes only, never message texts (ADR 0055). */
abstract class ConversationEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'conversation';
}

abstract class MessageEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'message';
}

abstract class IntroductionEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'introduction';
}

export class ConversationCreated extends ConversationEvent<{
  kind: string;
  /** `active`, or `request` for a first message out of network. */
  status: string;
  createdBy: string;
  participantIds: string[];
  introductionId: string | null;
}> {
  static readonly TYPE = 'messaging.conversation.created.v1';
  readonly type = ConversationCreated.TYPE;
  constructor(props: DomainEventProps<ConversationCreated['payload']>) {
    super(props);
  }
}

export class ConversationRequestAccepted extends ConversationEvent<{
  requesterId: string;
  recipientId: string;
  /** `answer` (the recipient accepted or replied) or `connected` (they connected since). */
  reason: string;
}> {
  static readonly TYPE = 'messaging.conversation.request-accepted.v1';
  readonly type = ConversationRequestAccepted.TYPE;
  constructor(props: DomainEventProps<ConversationRequestAccepted['payload']>) {
    super(props);
  }
}

export class ConversationRequestDeclined extends ConversationEvent<{
  requesterId: string;
  recipientId: string;
}> {
  static readonly TYPE = 'messaging.conversation.request-declined.v1';
  readonly type = ConversationRequestDeclined.TYPE;
  constructor(props: DomainEventProps<ConversationRequestDeclined['payload']>) {
    super(props);
  }
}

export class MessageSent extends MessageEvent<{
  conversationId: string;
  senderId: string;
  sequence: number;
  kind: string;
  /** Active participants other than the sender. */
  recipientIds: string[];
}> {
  static readonly TYPE = 'messaging.message.sent.v1';
  readonly type = MessageSent.TYPE;
  constructor(props: DomainEventProps<MessageSent['payload']>) {
    super(props);
  }
}

export class MessageEdited extends MessageEvent<{
  conversationId: string;
  senderId: string;
  sequence: number;
}> {
  static readonly TYPE = 'messaging.message.edited.v1';
  readonly type = MessageEdited.TYPE;
  constructor(props: DomainEventProps<MessageEdited['payload']>) {
    super(props);
  }
}

export class MessageDeleted extends MessageEvent<{
  conversationId: string;
  senderId: string;
  sequence: number;
}> {
  static readonly TYPE = 'messaging.message.deleted.v1';
  readonly type = MessageDeleted.TYPE;
  constructor(props: DomainEventProps<MessageDeleted['payload']>) {
    super(props);
  }
}

type IntroductionParties = { introducerId: string; firstId: string; secondId: string };

export class IntroductionProposed extends IntroductionEvent<IntroductionParties> {
  static readonly TYPE = 'messaging.introduction.proposed.v1';
  readonly type = IntroductionProposed.TYPE;
  constructor(props: DomainEventProps<IntroductionProposed['payload']>) {
    super(props);
  }
}

export class IntroductionAccepted extends IntroductionEvent<IntroductionParties & { by: string }> {
  static readonly TYPE = 'messaging.introduction.accepted.v1';
  readonly type = IntroductionAccepted.TYPE;
  constructor(props: DomainEventProps<IntroductionAccepted['payload']>) {
    super(props);
  }
}

export class IntroductionDeclined extends IntroductionEvent<IntroductionParties & { by: string }> {
  static readonly TYPE = 'messaging.introduction.declined.v1';
  readonly type = IntroductionDeclined.TYPE;
  constructor(props: DomainEventProps<IntroductionDeclined['payload']>) {
    super(props);
  }
}

export class IntroductionCompleted extends IntroductionEvent<
  IntroductionParties & { conversationId: string }
> {
  static readonly TYPE = 'messaging.introduction.completed.v1';
  readonly type = IntroductionCompleted.TYPE;
  constructor(props: DomainEventProps<IntroductionCompleted['payload']>) {
    super(props);
  }
}

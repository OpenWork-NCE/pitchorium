import { z } from 'zod';
import { errorCodeSchema } from './errors/error-codes.js';
import { uuidV7Schema } from './ids.js';
import { messagePageSchema, messageSchema, sendMessageRequestSchema } from './messaging.js';
import { countersSchema, notificationSchema } from './notifications.js';
import { handleSchema } from './profiles.js';

/**
 * Socket.IO protocol of the members namespace `/` (docs/architecture/realtime.md, ADR 0056).
 * Every payload is validated by these schemas on both sides.
 */
export const CLIENT_EVENTS = {
  send: 'messaging:send',
  sync: 'messaging:sync',
  read: 'messaging:read',
  typing: 'messaging:typing',
} as const;

export const SERVER_EVENTS = {
  message: 'messaging:message',
  messageUpdated: 'messaging:message-updated',
  read: 'messaging:read',
  typing: 'messaging:typing',
  conversation: 'messaging:conversation',
  notification: 'notifications:notification',
  counters: 'counters',
} as const;

/** Client to server, answered by an acknowledgement. */
export const socketSendSchema = sendMessageRequestSchema.extend({ conversationId: uuidV7Schema });
export const socketSyncSchema = z.object({
  conversationId: uuidV7Schema,
  /** Last sequence the client holds; the missing messages come back in order. */
  afterSequence: z.number().int().min(0),
  limit: z.number().int().min(1).max(100).default(100),
});
export const socketReadSchema = z.object({
  conversationId: uuidV7Schema,
  sequence: z.number().int().min(0),
});
/** Client to server, without acknowledgement nor persistence. */
export const socketTypingSchema = z.object({ conversationId: uuidV7Schema });

/** Acknowledgement: the result, or a stable error code. */
export function socketAckSchema<T extends z.ZodType>(result: T) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), result }),
    z.object({ ok: z.literal(false), code: errorCodeSchema }),
  ]);
}
export const socketSendAckSchema = socketAckSchema(messageSchema);
export const socketSyncAckSchema = socketAckSchema(messagePageSchema);
export const socketReadAckSchema = socketAckSchema(z.object({ sequence: z.number().int() }));

/** Server to client. */
export const serverMessageEventSchema = z.object({ message: messageSchema });
export const serverReadEventSchema = z.object({
  conversationId: uuidV7Schema,
  /** Null for a participant who no longer shows to the receiver. */
  handle: handleSchema.nullable(),
  mine: z.boolean(),
  sequence: z.number().int(),
});
export const serverTypingEventSchema = z.object({
  conversationId: uuidV7Schema,
  handle: handleSchema,
});
export const CONVERSATION_CHANGES = [
  'created',
  'request_received',
  'request_accepted',
  'state_changed',
  'participant_left',
] as const;
export const serverConversationEventSchema = z.object({
  conversationId: uuidV7Schema,
  change: z.enum(CONVERSATION_CHANGES),
});
export const serverNotificationEventSchema = z.object({ notification: notificationSchema });
export const serverCountersEventSchema = z.object({ counters: countersSchema });

export type SocketSend = z.infer<typeof socketSendSchema>;
export type SocketSync = z.infer<typeof socketSyncSchema>;
export type SocketRead = z.infer<typeof socketReadSchema>;
export type SocketTyping = z.infer<typeof socketTypingSchema>;
export type ServerMessageEvent = z.infer<typeof serverMessageEventSchema>;
export type ServerReadEvent = z.infer<typeof serverReadEventSchema>;
export type ServerTypingEvent = z.infer<typeof serverTypingEventSchema>;
export type ServerConversationEvent = z.infer<typeof serverConversationEventSchema>;
export type ConversationChange = (typeof CONVERSATION_CHANGES)[number];

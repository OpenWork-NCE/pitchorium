import { z } from 'zod';
import { postSchema } from './content.js';
import { uuidV7Schema } from './ids.js';
import { mediaVariantSchema } from './media.js';
import { cursorPageQuerySchema, cursorPageSchema } from './pagination.js';
import { handleSchema, memberCardSchema } from './profiles.js';

/** Messaging (§10.4, ADR 0055 to 0058). Limits are provisional (docs/open-questions.md). */
export const MESSAGE_BODY_MAX_LENGTH = 8000;
export const MESSAGE_ATTACHMENTS_MAX = 5;
export const INTRODUCTION_NOTE_MAX_LENGTH = 1000;

/** Who may write to a member out of network; `connections_and_second_degree` by default. */
export const MESSAGE_POLICIES = [
  'connections_only',
  'connections_and_second_degree',
  'verified_members',
] as const;
export const messagePolicySchema = z.enum(MESSAGE_POLICIES);

export const CONVERSATION_KINDS = ['direct', 'group'] as const;
export const conversationKindSchema = z.enum(CONVERSATION_KINDS);

/**
 * A message request as the viewer sees it: `sent` stays `sent` after a decline, which is silent
 * for the sender.
 */
export const REQUEST_STATES = ['none', 'sent', 'received'] as const;
export const requestStateSchema = z.enum(REQUEST_STATES);

export const MESSAGE_KINDS = ['text', 'introduction'] as const;
export const messageKindSchema = z.enum(MESSAGE_KINDS);

export const MESSAGE_MODERATION_STATUSES = ['visible', 'hidden', 'removed'] as const;
export const messageModerationStatusSchema = z.enum(MESSAGE_MODERATION_STATUSES);

export const CONVERSATION_BOXES = ['inbox', 'requests', 'archived'] as const;
export const conversationBoxSchema = z.enum(CONVERSATION_BOXES);

export const INTRODUCTION_STATUSES = ['pending', 'completed', 'declined'] as const;
export const introductionStatusSchema = z.enum(INTRODUCTION_STATUSES);

export const INTRODUCTION_ANSWERS = ['pending', 'accepted', 'declined'] as const;
export const introductionAnswerSchema = z.enum(INTRODUCTION_ANSWERS);

export const INTRODUCTION_ROLES = ['introducer', 'first', 'second'] as const;
export const introductionRoleSchema = z.enum(INTRODUCTION_ROLES);

/** Chosen by the sender to deduplicate a send retried after a lost answer. */
export const clientMessageIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

const messageContentShape = {
  clientMessageId: clientMessageIdSchema,
  body: z.string().trim().max(MESSAGE_BODY_MAX_LENGTH).default(''),
  /** Ready files of the sender with the usage `message_attachment`. */
  attachmentIds: z.array(uuidV7Schema).max(MESSAGE_ATTACHMENTS_MAX).default([]),
  /** Publication forwarded as a card (§10.3 « transférer en message »). */
  sharedPostId: uuidV7Schema.optional(),
};

export const sendMessageRequestSchema = z.object(messageContentShape);

export const startConversationRequestSchema = z.object({
  recipientHandle: handleSchema,
  ...messageContentShape,
});

export const editMessageRequestSchema = z.object({
  body: z.string().trim().min(1).max(MESSAGE_BODY_MAX_LENGTH),
});

export const messageAttachmentSchema = z.object({
  mediaId: uuidV7Schema,
  /** Image variants with short-lived URLs; null for a PDF, read by its download URL. */
  image: z
    .object({ url: z.string(), variants: z.record(z.string(), mediaVariantSchema) })
    .nullable(),
});

/** Publication shared in a message, checked against the visibility for each reader. */
export const sharedPostSchema = z.object({
  postId: uuidV7Schema,
  /** Null when deleted, or not visible to the reader. */
  post: postSchema.nullable(),
});

export const messageSchema = z.object({
  id: uuidV7Schema,
  conversationId: uuidV7Schema,
  /** Server order of the conversation, from 1, without gap. */
  sequence: z.number().int().positive(),
  clientMessageId: z.string(),
  kind: messageKindSchema,
  /** Null when the sender no longer shows to the reader (deleted account, block). */
  senderHandle: handleSchema.nullable(),
  mine: z.boolean(),
  /** Null for a deleted message (tombstone) or one hidden by moderation. */
  body: z.string().nullable(),
  attachments: z.array(messageAttachmentSchema),
  sharedPost: sharedPostSchema.nullable(),
  edited: z.boolean(),
  deleted: z.boolean(),
  moderationStatus: messageModerationStatusSchema,
  createdAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
});

export const conversationParticipantSchema = z.object({
  member: memberCardSchema,
  /** Last message read, for the read receipts. */
  lastReadSequence: z.number().int(),
  left: z.boolean(),
});

export const conversationSchema = z.object({
  id: uuidV7Schema,
  kind: conversationKindSchema,
  requestState: requestStateSchema,
  /** The other participants shown to the viewer. */
  participants: z.array(conversationParticipantSchema),
  lastMessage: messageSchema.nullable(),
  lastSequence: z.number().int(),
  lastReadSequence: z.number().int(),
  unreadCount: z.number().int(),
  markedUnread: z.boolean(),
  archived: z.boolean(),
  muted: z.boolean(),
  /** False while a request waits for the recipient, after leaving a group, or across a block. */
  canSend: z.boolean(),
  introductionId: uuidV7Schema.nullable(),
  lastMessageAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const conversationPageSchema = cursorPageSchema(conversationSchema);
export const conversationListQuerySchema = cursorPageQuerySchema.extend({
  box: conversationBoxSchema.default('inbox'),
});
export const conversationIdParamsSchema = z.object({ conversationId: uuidV7Schema });
export const messageIdParamsSchema = z.object({
  conversationId: uuidV7Schema,
  messageId: uuidV7Schema,
});

/** Messages after a known sequence (sync after reconnection) or before one (history). */
export const messageListQuerySchema = z.object({
  afterSequence: z.coerce.number().int().min(0).optional(),
  beforeSequence: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const messagePageSchema = z.object({
  items: z.array(messageSchema),
  lastSequence: z.number().int(),
  hasMore: z.boolean(),
});

export const readConversationRequestSchema = z.object({
  sequence: z.number().int().min(0),
});

export const updateConversationRequestSchema = z.object({
  archived: z.boolean().optional(),
  muted: z.boolean().optional(),
  /** True marks the conversation unread; reading it clears the mark. */
  unread: z.boolean().optional(),
});

export const messagingSettingsSchema = z.object({ messagePolicy: messagePolicySchema });

export const proposeIntroductionRequestSchema = z.object({
  firstHandle: handleSchema,
  secondHandle: handleSchema,
  note: z.string().trim().min(1).max(INTRODUCTION_NOTE_MAX_LENGTH),
});

export const introductionSchema = z.object({
  id: uuidV7Schema,
  role: introductionRoleSchema,
  introducer: memberCardSchema.nullable(),
  first: memberCardSchema.nullable(),
  second: memberCardSchema.nullable(),
  note: z.string(),
  answers: z.object({ first: introductionAnswerSchema, second: introductionAnswerSchema }),
  status: introductionStatusSchema,
  conversationId: uuidV7Schema.nullable(),
  createdAt: z.iso.datetime(),
});

export const introductionPageSchema = cursorPageSchema(introductionSchema);
export const introductionIdParamsSchema = z.object({ introductionId: uuidV7Schema });

export type MessagePolicy = z.infer<typeof messagePolicySchema>;
export type ConversationKind = z.infer<typeof conversationKindSchema>;
export type RequestState = z.infer<typeof requestStateSchema>;
export type MessageKind = z.infer<typeof messageKindSchema>;
export type MessageModerationStatus = z.infer<typeof messageModerationStatusSchema>;
export type ConversationBox = z.infer<typeof conversationBoxSchema>;
export type IntroductionStatus = z.infer<typeof introductionStatusSchema>;
export type IntroductionAnswer = z.infer<typeof introductionAnswerSchema>;
export type IntroductionRole = z.infer<typeof introductionRoleSchema>;
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;
export type StartConversationRequest = z.infer<typeof startConversationRequestSchema>;
export type EditMessageRequest = z.infer<typeof editMessageRequestSchema>;
export type Message = z.infer<typeof messageSchema>;
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type ConversationParticipant = z.infer<typeof conversationParticipantSchema>;
export type ConversationListQuery = z.infer<typeof conversationListQuerySchema>;
export type MessageListQuery = z.infer<typeof messageListQuerySchema>;
export type MessagePage = z.infer<typeof messagePageSchema>;
export type UpdateConversationRequest = z.infer<typeof updateConversationRequestSchema>;
export type MessagingSettings = z.infer<typeof messagingSettingsSchema>;
export type ProposeIntroductionRequest = z.infer<typeof proposeIntroductionRequestSchema>;
export type Introduction = z.infer<typeof introductionSchema>;

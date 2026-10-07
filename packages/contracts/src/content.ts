import { z } from 'zod';
import { uuidV7Schema } from './ids.js';
import { mediaVariantSchema } from './media.js';
import { cursorPageSchema } from './pagination.js';
import { languageCodeSchema, memberCardSchema } from './profiles.js';

/** Limits of a publication (§10.3). */
export const POST_TEXT_MAX_LENGTH = 3000;
export const POST_MAX_IMAGES = 9;
/** Provisional, not given by the cahier des charges (docs/open-questions.md). */
export const COMMENT_TEXT_MAX_LENGTH = 1250;

/** Audience of a publication; `members` by default, `public` needs the author's public page. */
export const POST_VISIBILITIES = ['public', 'members', 'connections'] as const;
export const postVisibilitySchema = z.enum(POST_VISIBILITIES);

/** Professional reactions (§10.3): J'aime, Bravo, Pertinent, Soutien. */
export const REACTION_TYPES = ['like', 'bravo', 'insightful', 'support'] as const;
export const reactionTypeSchema = z.enum(REACTION_TYPES);

/** Set by moderation (trust module): `hidden` and `removed` are no longer shown. */
export const CONTENT_MODERATION_STATUSES = ['visible', 'hidden', 'removed'] as const;
export const contentModerationStatusSchema = z.enum(CONTENT_MODERATION_STATUSES);

/** Whether the language was declared by the author or detected (`undetermined` when neither). */
export const LANGUAGE_SOURCES = ['declared', 'detected', 'undetermined'] as const;
export const languageSourceSchema = z.enum(LANGUAGE_SOURCES);

export const LINK_PREVIEW_STATUSES = ['pending', 'ready', 'failed'] as const;
export const linkPreviewStatusSchema = z.enum(LINK_PREVIEW_STATUSES);

export const postLinkUrlSchema = z.url({ protocol: /^https?$/ }).max(2048);

export const createPostRequestSchema = z.object({
  text: z.string().trim().max(POST_TEXT_MAX_LENGTH).optional(),
  visibility: postVisibilitySchema.default('members'),
  /** Declared language (ISO 639-1); detected from the text otherwise. */
  language: languageCodeSchema.optional(),
  /** Up to nine ready images (usage `post_image`), or one document. */
  imageMediaIds: z.array(uuidV7Schema).max(POST_MAX_IMAGES).optional(),
  /** One ready PDF (usage `post_document`). */
  documentMediaId: uuidV7Schema.optional(),
  linkUrl: postLinkUrlSchema.optional(),
  /** Publish as an organization the author is an owner or admin of. */
  organizationId: uuidV7Schema.optional(),
  /** Project the publication is attached to (projects module). */
  projectId: uuidV7Schema.optional(),
  commentsDisabled: z.boolean().default(false),
});

export const updatePostRequestSchema = z.object({
  text: z.string().trim().max(POST_TEXT_MAX_LENGTH).optional(),
  visibility: postVisibilitySchema.optional(),
  language: languageCodeSchema.nullable().optional(),
  commentsDisabled: z.boolean().optional(),
});

export const createRepostRequestSchema = z.object({
  /** Optional comment shown above the reposted publication. */
  comment: z.string().trim().max(POST_TEXT_MAX_LENGTH).optional(),
  visibility: postVisibilitySchema.default('members'),
});

export const postAuthorSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('member'), member: memberCardSchema }),
  z.object({
    type: z.literal('organization'),
    organization: z.object({
      id: uuidV7Schema,
      slug: z.string(),
      name: z.string(),
      logoUrl: z.string().nullable(),
      verified: z.boolean(),
    }),
  }),
]);

export const postImageSchema = z.object({
  mediaId: uuidV7Schema,
  /** Largest variant; a presigned URL for a non-public publication. */
  url: z.string(),
  variants: z.record(z.string(), mediaVariantSchema),
});

export const postDocumentSchema = z.object({
  mediaId: uuidV7Schema,
  /** Always private: read through GET /v1/media/{mediaId}/download-url. */
  thumbnailUrl: z.string().nullable(),
  pageCount: z.number().int().nullable(),
});

export const linkPreviewSchema = z.object({
  url: z.string(),
  status: linkPreviewStatusSchema,
  title: z.string().nullable(),
  description: z.string().nullable(),
  siteName: z.string().nullable(),
  /** Image imported by the platform (never the third-party URL). */
  imageUrl: z.string().nullable(),
});

export const MENTION_TARGET_TYPES = ['member', 'organization'] as const;
export const mentionTargetTypeSchema = z.enum(MENTION_TARGET_TYPES);

export const mentionSchema = z.object({
  /** Token as written in the text, `@handle` or `@slug`. */
  token: z.string(),
  type: mentionTargetTypeSchema,
  /** Current handle of the member or slug of the organization. */
  key: z.string(),
  displayName: z.string(),
});

export const reactionCountsSchema = z.object({
  like: z.number().int(),
  bravo: z.number().int(),
  insightful: z.number().int(),
  support: z.number().int(),
});

export const reactionSummarySchema = z.object({
  counts: reactionCountsSchema,
  total: z.number().int(),
  viewerReaction: reactionTypeSchema.nullable(),
});

const postFields = {
  id: uuidV7Schema,
  author: postAuthorSchema,
  text: z.string().nullable(),
  language: z.string().nullable(),
  languageSource: languageSourceSchema,
  visibility: postVisibilitySchema,
  images: z.array(postImageSchema),
  document: postDocumentSchema.nullable(),
  link: linkPreviewSchema.nullable(),
  mentions: z.array(mentionSchema),
  projectId: uuidV7Schema.nullable(),
  commentsDisabled: z.boolean(),
  reactions: reactionSummarySchema,
  commentCount: z.number().int(),
  repostCount: z.number().int(),
  saved: z.boolean(),
  viewerIsAuthor: z.boolean(),
  featured: z.boolean(),
  createdAt: z.iso.datetime(),
  /** Shown as « modifié » when not null. */
  editedAt: z.iso.datetime().nullable(),
};

/** A publication reposted inside another one. */
export const embeddedPostSchema = z.object(postFields);

export const postSchema = z.object({
  ...postFields,
  kind: z.enum(['post', 'repost']),
  /** Reposted publication, null when it was deleted or is not visible to the viewer. */
  repostOf: embeddedPostSchema.nullable(),
});

/**
 * Types of feed items. `post`, `repost` and `featured` exist; the others are reserved for the
 * projects and discovery modules: clients must ignore a type they do not know (ADR 0032).
 */
export const FEED_ITEM_TYPES = ['post', 'repost', 'featured'] as const;
export const RESERVED_FEED_ITEM_TYPES = ['project_update', 'project', 'suggestion'] as const;
export const FEED_SCHEMA_VERSION = 1;

export const feedItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('post'), id: z.string(), post: postSchema }),
  z.object({ type: z.literal('repost'), id: z.string(), post: postSchema }),
  /** Editorial highlight completing a feed whose network produces too little. */
  z.object({ type: z.literal('featured'), id: z.string(), post: postSchema }),
]);

export const feedPageSchema = z.object({
  schemaVersion: z.literal(FEED_SCHEMA_VERSION),
  items: z.array(feedItemSchema),
  nextCursor: z.string().nullable(),
});

export const createCommentRequestSchema = z.object({
  text: z.string().trim().min(1).max(COMMENT_TEXT_MAX_LENGTH),
  /** Top-level comment answered; a reply to a reply is attached to its top-level comment. */
  parentId: uuidV7Schema.optional(),
});

export const updateCommentRequestSchema = z.object({
  text: z.string().trim().min(1).max(COMMENT_TEXT_MAX_LENGTH),
});

export const commentSchema = z.object({
  id: uuidV7Schema,
  postId: uuidV7Schema,
  parentId: uuidV7Schema.nullable(),
  author: memberCardSchema,
  text: z.string(),
  reactions: reactionSummarySchema,
  replyCount: z.number().int(),
  viewerIsAuthor: z.boolean(),
  /** The viewer may delete it: its author, or the author of the publication. */
  viewerCanDelete: z.boolean(),
  createdAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
});

export const setReactionRequestSchema = z.object({ type: reactionTypeSchema });

export const savedPostSchema = z.object({ savedAt: z.iso.datetime(), post: postSchema });

export const postStatsSchema = z.object({
  postId: uuidV7Schema,
  /** Unique members who saw the publication each day (approximate, consolidated periodically). */
  days: z.array(z.object({ day: z.iso.date(), uniqueViewers: z.number().int() })),
});

export const postIdParamsSchema = z.object({ postId: uuidV7Schema });
export const commentIdParamsSchema = z.object({ commentId: uuidV7Schema });

export const commentPageSchema = cursorPageSchema(commentSchema);
export const savedPostPageSchema = cursorPageSchema(savedPostSchema);

export type PostVisibility = z.infer<typeof postVisibilitySchema>;
export type ReactionType = z.infer<typeof reactionTypeSchema>;
export type ContentModerationStatus = z.infer<typeof contentModerationStatusSchema>;
export type LanguageSource = z.infer<typeof languageSourceSchema>;
export type LinkPreviewStatus = z.infer<typeof linkPreviewStatusSchema>;
export type CreatePostRequest = z.infer<typeof createPostRequestSchema>;
export type UpdatePostRequest = z.infer<typeof updatePostRequestSchema>;
export type CreateRepostRequest = z.infer<typeof createRepostRequestSchema>;
export type PostAuthor = z.infer<typeof postAuthorSchema>;
export type PostImage = z.infer<typeof postImageSchema>;
export type PostDocument = z.infer<typeof postDocumentSchema>;
export type LinkPreview = z.infer<typeof linkPreviewSchema>;
export type MentionTargetType = z.infer<typeof mentionTargetTypeSchema>;
export type Mention = z.infer<typeof mentionSchema>;
export type ReactionCounts = z.infer<typeof reactionCountsSchema>;
export type ReactionSummary = z.infer<typeof reactionSummarySchema>;
export type EmbeddedPost = z.infer<typeof embeddedPostSchema>;
export type Post = z.infer<typeof postSchema>;
export type FeedItem = z.infer<typeof feedItemSchema>;
export type FeedPage = z.infer<typeof feedPageSchema>;
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type SavedPost = z.infer<typeof savedPostSchema>;
export type PostStats = z.infer<typeof postStatsSchema>;

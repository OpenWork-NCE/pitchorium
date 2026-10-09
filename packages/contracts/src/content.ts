import { z } from 'zod';
import { uuidV7Schema } from './ids.js';
import { mediaVariantSchema } from './media.js';
import { cursorPageSchema } from './pagination.js';
import { languageCodeSchema, memberCardSchema } from './profiles.js';
import { feedSuggestionSchema } from './discovery.js';
import { eventCardSchema } from './events.js';
import { projectUpdateFeedEntrySchema } from './projects.js';

/** Limits of a publication (§10.3). */
export const POST_TEXT_MAX_LENGTH = 3000;
export const POST_MAX_IMAGES = 9;
/** Provisional, not given by the cahier des charges (docs/open-questions.md). */
export const COMMENT_TEXT_MAX_LENGTH = 1250;
/** Text alternative of an image, written by the author (accessibility, WCAG 1.1.1). */
export const POST_IMAGE_ALT_MAX_LENGTH = 1000;
/** Title of the document of a publication, shown above it (its file name by default). */
export const POST_DOCUMENT_TITLE_MAX_LENGTH = 200;

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

export const postImageAltSchema = z.string().trim().max(POST_IMAGE_ALT_MAX_LENGTH);
export const postDocumentTitleSchema = z.string().trim().min(1).max(POST_DOCUMENT_TITLE_MAX_LENGTH);

/** A ready image of a publication (usage `post_image`) and its text alternative. */
export const postImageInputSchema = z.object({
  mediaId: uuidV7Schema,
  /** Empty or absent: no text alternative (the interface asks the author for one). */
  alt: postImageAltSchema.optional(),
});

export const createPostRequestSchema = z.object({
  text: z.string().trim().max(POST_TEXT_MAX_LENGTH).optional(),
  visibility: postVisibilitySchema.default('members'),
  /** Declared language (ISO 639-1); detected from the text otherwise. */
  language: languageCodeSchema.optional(),
  /** Up to nine ready images (usage `post_image`) in their order, or one document. */
  images: z.array(postImageInputSchema).max(POST_MAX_IMAGES).optional(),
  /** One ready PDF (usage `post_document`). */
  documentMediaId: uuidV7Schema.optional(),
  /** Title of the document; its file name is a good default. */
  documentTitle: postDocumentTitleSchema.optional(),
  linkUrl: postLinkUrlSchema.optional(),
  /** Preview the composer asked for the same link (ADR 0118); built again otherwise. */
  linkPreviewId: uuidV7Schema.optional(),
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
  /** Text alternatives of images of the publication, by image; null or empty removes one. */
  imageAlts: z
    .array(z.object({ mediaId: uuidV7Schema, alt: postImageAltSchema.nullable() }))
    .max(POST_MAX_IMAGES)
    .optional(),
  documentTitle: postDocumentTitleSchema.nullable().optional(),
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
  /** Text alternative written by the author; null when they wrote none. */
  alt: z.string().nullable(),
});

export const postDocumentSchema = z.object({
  mediaId: uuidV7Schema,
  /** Always private: read through GET /v1/media/{mediaId}/download-url. */
  thumbnailUrl: z.string().nullable(),
  pageCount: z.number().int().nullable(),
  title: z.string().nullable(),
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

/** The composer asks for the preview of a link as soon as it is pasted (ADR 0118). */
export const createLinkPreviewRequestSchema = z.object({ url: postLinkUrlSchema });

/** Preview of a link before publishing: polled until `ready` or `failed`. */
export const linkPreviewDraftSchema = linkPreviewSchema.extend({ id: uuidV7Schema });

export const linkPreviewIdParamsSchema = z.object({ linkPreviewId: uuidV7Schema });

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
 * Types of feed items. `post`, `repost`, `featured`, `project_update`, `event` and `suggestion`
 * exist; `project` is reserved for the projects module: clients must ignore a type they do not
 * know, so adding a type keeps the schema version (ADR 0032).
 */
export const FEED_ITEM_TYPES = [
  'post',
  'repost',
  'featured',
  'project_update',
  'event',
  'suggestion',
] as const;
export const RESERVED_FEED_ITEM_TYPES = ['project'] as const;
export const FEED_SCHEMA_VERSION = 1;

export const feedItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('post'), id: z.string(), post: postSchema }),
  z.object({ type: z.literal('repost'), id: z.string(), post: postSchema }),
  /** Editorial highlight completing a feed whose network produces too little. */
  z.object({ type: z.literal('featured'), id: z.string(), post: postSchema }),
  /** Update of a project the reader follows (section 11.3). */
  z.object({
    type: z.literal('project_update'),
    id: z.string(),
    update: projectUpdateFeedEntrySchema,
  }),
  /** Event published by a member or an organization the reader follows (events module). */
  z.object({ type: z.literal('event'), id: z.string(), event: eventCardSchema }),
  /** Suggestion completing a small network, with its reason (discovery module). */
  z.object({ type: z.literal('suggestion'), id: z.string(), suggestion: feedSuggestionSchema }),
]);

export const feedPageSchema = z.object({
  schemaVersion: z.literal(FEED_SCHEMA_VERSION),
  items: z.array(feedItemSchema),
  nextCursor: z.string().nullable(),
  /**
   * Position of the newest item of the network on the first page (opaque), for
   * GET /v1/feed/newer; null on the next pages.
   */
  head: z.string().nullable(),
});

/** Newer publications counted at most: the interface says « 20+ ». */
export const FEED_NEWER_CAP = 20;

export const feedNewerQuerySchema = z.object({ head: z.string().min(1).max(512) });

/** Publications of the network newer than the head of the feed, by others than the reader. */
export const feedNewerSchema = z.object({
  count: z.number().int().min(0).max(FEED_NEWER_CAP),
  /** More than FEED_NEWER_CAP. */
  capped: z.boolean(),
});

export const createCommentRequestSchema = z.object({
  text: z.string().trim().min(1).max(COMMENT_TEXT_MAX_LENGTH),
  /** Top-level comment answered; a reply to a reply is refused (one level of nesting). */
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

/** Publications seen at least half for a second, at most per signal (ADR 0116). */
export const POST_VIEWS_MAX_PER_SIGNAL = 50;

/** Publications the reader saw on screen, grouped: each counts once per member and per day. */
export const recordPostViewsRequestSchema = z.object({
  postIds: z.array(uuidV7Schema).min(1).max(POST_VIEWS_MAX_PER_SIGNAL),
});

export const postIdParamsSchema = z.object({ postId: uuidV7Schema });
export const memberPostsParamsSchema = z.object({ handle: z.string().min(1).max(100) });
export const organizationPostsParamsSchema = z.object({ slug: z.string().min(1).max(100) });
export const commentIdParamsSchema = z.object({ commentId: uuidV7Schema });

export const commentPageSchema = cursorPageSchema(commentSchema);
export const savedPostPageSchema = cursorPageSchema(savedPostSchema);
/** Publications of a member or an organization, newest first, as the reader may see them. */
export const postPageSchema = cursorPageSchema(postSchema);

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
export type LinkPreviewDraft = z.infer<typeof linkPreviewDraftSchema>;
export type CreateLinkPreviewRequest = z.infer<typeof createLinkPreviewRequestSchema>;
export type MentionTargetType = z.infer<typeof mentionTargetTypeSchema>;
export type Mention = z.infer<typeof mentionSchema>;
export type ReactionCounts = z.infer<typeof reactionCountsSchema>;
export type ReactionSummary = z.infer<typeof reactionSummarySchema>;
export type EmbeddedPost = z.infer<typeof embeddedPostSchema>;
export type Post = z.infer<typeof postSchema>;
export type FeedItem = z.infer<typeof feedItemSchema>;
export type FeedPage = z.infer<typeof feedPageSchema>;
export type FeedNewer = z.infer<typeof feedNewerSchema>;
export type CreateCommentRequest = z.infer<typeof createCommentRequestSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type SavedPost = z.infer<typeof savedPostSchema>;
export type PostStats = z.infer<typeof postStatsSchema>;
export type RecordPostViewsRequest = z.infer<typeof recordPostViewsRequestSchema>;

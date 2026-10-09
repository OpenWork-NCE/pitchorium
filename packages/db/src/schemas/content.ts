import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const contentSchema = pgSchema('content');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** Open Graph preview of the link of a publication, filled by the worker. */
export interface LinkPreviewRecord {
  status: 'pending' | 'ready' | 'failed';
  title: string | null;
  description: string | null;
  siteName: string | null;
  /** Image imported through the media module (usage `link_preview`). */
  imageMediaId: string | null;
}

/**
 * Publications and reposts (§10.3). Authors, organizations, projects and media are identifiers
 * of other modules (no cross-module FK).
 */
export const contentPosts = contentSchema.table(
  'posts',
  {
    id: uuid('id').primaryKey(),
    /** Member who wrote it, also when it is published as an organization. */
    authorId: uuid('author_id').notNull(),
    organizationId: uuid('organization_id'),
    kind: text('kind').notNull(),
    text: text('text'),
    language: text('language'),
    languageSource: text('language_source').notNull(),
    visibility: text('visibility').notNull(),
    repostOfId: uuid('repost_of_id').references((): AnyPgColumn => contentPosts.id),
    projectId: uuid('project_id'),
    imageMediaIds: uuid('image_media_ids').array().notNull(),
    /** Text alternatives of the images, by media id (written by the author). */
    imageAlts: jsonb('image_alts').$type<Record<string, string>>().notNull().default({}),
    documentMediaId: uuid('document_media_id'),
    documentTitle: text('document_title'),
    linkUrl: text('link_url'),
    linkPreview: jsonb('link_preview').$type<LinkPreviewRecord>(),
    commentsDisabled: boolean('comments_disabled').notNull(),
    moderationStatus: text('moderation_status').notNull(),
    featuredAt: timestamptz('featured_at'),
    featuredBy: uuid('featured_by'),
    createdAt: timestamptz('created_at').notNull(),
    editedAt: timestamptz('edited_at'),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => [
    // Fan-out on read (ADR 0032): the newest publications of each followed member, read
    // backwards; ascending columns with the id as keyset tie-breaker.
    index('posts_member_feed_idx')
      .on(table.authorId, table.createdAt, table.id)
      .where(sql`${table.deletedAt} is null and ${table.organizationId} is null`),
    index('posts_organization_feed_idx')
      .on(table.organizationId, table.createdAt, table.id)
      .where(sql`${table.deletedAt} is null and ${table.organizationId} is not null`),
    // Editorial complement of a feed whose network produces too little.
    index('posts_featured_idx')
      .on(table.featuredAt, table.id)
      .where(sql`${table.featuredAt} is not null and ${table.deletedAt} is null`),
    // Publications attached to a project, shown on its page (§10.3).
    index('posts_project_idx')
      .on(table.projectId, table.createdAt, table.id)
      .where(sql`${table.projectId} is not null and ${table.deletedAt} is null`),
    index('posts_repost_of_idx')
      .on(table.repostOfId)
      .where(sql`${table.repostOfId} is not null and ${table.deletedAt} is null`),
    // Publications attached to a media awaiting its link preview image.
    index('posts_link_preview_image_idx')
      .on(sql`(${table.linkPreview} ->> 'imageMediaId')`)
      .where(sql`${table.linkPreview} ->> 'imageMediaId' is not null`),
  ],
);

/**
 * Preview of a link asked by the composer before publishing (ADR 0118): built by the worker as
 * for a publication, reused by the publication that carries its id, purged after a day.
 */
export const contentLinkPreviews = contentSchema.table(
  'link_previews',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id').notNull(),
    url: text('url').notNull(),
    status: text('status').notNull(),
    title: text('title'),
    description: text('description'),
    siteName: text('site_name'),
    /** Image imported through the media module (usage `link_preview`). */
    imageMediaId: uuid('image_media_id'),
    createdAt: timestamptz('created_at').notNull(),
  },
  (table) => [
    index('link_previews_owner_idx').on(table.ownerId),
    index('link_previews_created_idx').on(table.createdAt),
    index('link_previews_image_idx')
      .on(table.imageMediaId)
      .where(sql`${table.imageMediaId} is not null`),
  ],
);

/** Mentions resolved to stable identifiers when the publication is written. */
export const contentPostMentions = contentSchema.table(
  'post_mentions',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => contentPosts.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    /** Token as written, `@handle` or `@slug`. */
    token: text('token').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'post_mentions_pk',
      columns: [table.postId, table.targetType, table.targetId],
    }),
  ],
);

/** Comments and replies, one level of nesting. */
export const contentComments = contentSchema.table(
  'comments',
  {
    id: uuid('id').primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => contentPosts.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => contentComments.id),
    authorId: uuid('author_id').notNull(),
    text: text('text').notNull(),
    moderationStatus: text('moderation_status').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    editedAt: timestamptz('edited_at'),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => [
    index('comments_post_top_level_idx')
      .on(table.postId, table.createdAt, table.id)
      .where(sql`${table.parentId} is null and ${table.deletedAt} is null`),
    index('comments_replies_idx')
      .on(table.parentId, table.createdAt, table.id)
      .where(sql`${table.parentId} is not null and ${table.deletedAt} is null`),
  ],
);

/** Mentions of a comment, resolved like those of a publication when it is written. */
export const contentCommentMentions = contentSchema.table(
  'comment_mentions',
  {
    commentId: uuid('comment_id')
      .notNull()
      .references(() => contentComments.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    /** Token as written, `@handle` or `@slug`. */
    token: text('token').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'comment_mentions_pk',
      columns: [table.commentId, table.targetType, table.targetId],
    }),
  ],
);

/** One reaction per member and target (publication or comment), counted by aggregation. */
export const contentReactions = contentSchema.table(
  'reactions',
  {
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    userId: uuid('user_id').notNull(),
    type: text('type').notNull(),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ name: 'reactions_pk', columns: [table.targetType, table.targetId, table.userId] }),
  ],
);

export const contentSavedPosts = contentSchema.table(
  'saved_posts',
  {
    userId: uuid('user_id').notNull(),
    postId: uuid('post_id')
      .notNull()
      .references(() => contentPosts.id, { onDelete: 'cascade' }),
    savedAt: timestamptz('saved_at').notNull(),
  },
  (table) => [
    primaryKey({ name: 'saved_posts_pk', columns: [table.userId, table.postId] }),
    index('saved_posts_user_saved_idx').on(table.userId, table.savedAt, table.postId),
  ],
);

/** Publications a member hid from their own feed. */
export const contentHiddenPosts = contentSchema.table(
  'hidden_posts',
  {
    userId: uuid('user_id').notNull(),
    postId: uuid('post_id')
      .notNull()
      .references(() => contentPosts.id, { onDelete: 'cascade' }),
    hiddenAt: timestamptz('hidden_at').notNull(),
  },
  (table) => [primaryKey({ name: 'hidden_posts_pk', columns: [table.userId, table.postId] })],
);

/** Unique members who saw a publication each day, consolidated from Redis HyperLogLogs. */
export const contentPostDailyViews = contentSchema.table(
  'post_daily_views',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => contentPosts.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    uniqueViewers: integer('unique_viewers').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
  },
  (table) => [primaryKey({ name: 'post_daily_views_pk', columns: [table.postId, table.day] })],
);

import { Injectable } from '@nestjs/common';
import type {
  ContentModerationStatus,
  LanguageSource,
  PostVisibility,
  ReactionCounts,
  ReactionType,
} from '@pitchorium/contracts';
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  notInArray,
  sql,
  type SQL,
} from '@pitchorium/db/orm';
import {
  contentComments,
  contentHiddenPosts,
  contentPostDailyViews,
  contentPostMentions,
  contentPosts,
  contentReactions,
  contentSavedPosts,
} from '@pitchorium/db/schemas/content';
import { TransactionManager } from '../../../platform/database';
import type { KeysetPosition } from '../../../platform/kernel';
import type { CommentRecord } from '../domain/comment';
import type { ResolvedMention } from '../domain/mentions';
import type { LinkPreviewState, PostRecord } from '../domain/post';
import {
  type CommentPatch,
  ContentRepository,
  type FeedEntry,
  type NetworkFeedQuery,
  type PostPatch,
  type ReactionTarget,
} from '../application/ports';

type PostRow = typeof contentPosts.$inferSelect;
type CommentRow = typeof contentComments.$inferSelect;

const toPost = (row: PostRow): PostRecord => ({
  id: row.id,
  authorId: row.authorId,
  organizationId: row.organizationId,
  kind: row.kind as PostRecord['kind'],
  text: row.text,
  language: row.language,
  languageSource: row.languageSource as LanguageSource,
  visibility: row.visibility as PostVisibility,
  repostOfId: row.repostOfId,
  projectId: row.projectId,
  imageMediaIds: row.imageMediaIds,
  imageAlts: row.imageAlts,
  documentMediaId: row.documentMediaId,
  documentTitle: row.documentTitle,
  linkUrl: row.linkUrl,
  linkPreview: row.linkPreview,
  commentsDisabled: row.commentsDisabled,
  moderationStatus: row.moderationStatus as ContentModerationStatus,
  featuredAt: row.featuredAt,
  featuredBy: row.featuredBy,
  createdAt: row.createdAt,
  editedAt: row.editedAt,
  deletedAt: row.deletedAt,
});

const toComment = (row: CommentRow): CommentRecord => ({
  id: row.id,
  postId: row.postId,
  parentId: row.parentId,
  authorId: row.authorId,
  text: row.text,
  moderationStatus: row.moderationStatus as ContentModerationStatus,
  createdAt: row.createdAt,
  editedAt: row.editedAt,
  deletedAt: row.deletedAt,
});

const EMPTY_COUNTS = (): ReactionCounts => ({ like: 0, bravo: 0, insightful: 0, support: 0 });

/** Postgres array parameter of identifiers. */
const uuidArray = (ids: readonly string[]) => sql`${`{${ids.join(',')}}`}::uuid[]`;

@Injectable()
export class DrizzleContentRepository extends ContentRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async lock(key: string): Promise<void> {
    await this.db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }

  async insertPost(post: PostRecord): Promise<void> {
    await this.db.insert(contentPosts).values(post);
  }

  async findPost(id: string): Promise<PostRecord | null> {
    const [row] = await this.db.select().from(contentPosts).where(eq(contentPosts.id, id));
    return row ? toPost(row) : null;
  }

  async findPosts(ids: readonly string[]): Promise<PostRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(contentPosts)
      .where(inArray(contentPosts.id, [...new Set(ids)]));
    return rows.map(toPost);
  }

  async updatePost(id: string, patch: PostPatch): Promise<void> {
    await this.db.update(contentPosts).set(patch).where(eq(contentPosts.id, id));
  }

  async replaceMentions(postId: string, mentions: readonly ResolvedMention[]): Promise<void> {
    await this.db.delete(contentPostMentions).where(eq(contentPostMentions.postId, postId));
    if (mentions.length === 0) return;
    await this.db
      .insert(contentPostMentions)
      .values(mentions.map((mention) => ({ postId, ...mention })))
      .onConflictDoNothing();
  }

  async mentionsOf(postIds: readonly string[]): Promise<Map<string, ResolvedMention[]>> {
    const mentions = new Map<string, ResolvedMention[]>();
    if (postIds.length === 0) return mentions;
    const rows = await this.db
      .select()
      .from(contentPostMentions)
      .where(inArray(contentPostMentions.postId, [...postIds]));
    for (const row of rows) {
      mentions.set(row.postId, [
        ...(mentions.get(row.postId) ?? []),
        {
          token: row.token,
          targetType: row.targetType as ResolvedMention['targetType'],
          targetId: row.targetId,
        },
      ]);
    }
    return mentions;
  }

  async publicPostIdsOfMember(authorId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: contentPosts.id })
      .from(contentPosts)
      .where(
        and(
          eq(contentPosts.authorId, authorId),
          isNull(contentPosts.organizationId),
          isNull(contentPosts.deletedAt),
          eq(contentPosts.visibility, 'public'),
        ),
      );
    return rows.map((row) => row.id);
  }

  async postsWithPreviewImage(mediaId: string): Promise<PostRecord[]> {
    const rows = await this.db
      .select()
      .from(contentPosts)
      .where(sql`${contentPosts.linkPreview} ->> 'imageMediaId' = ${mediaId}`);
    return rows.map(toPost);
  }

  async setPreview(postId: string, preview: LinkPreviewState): Promise<void> {
    await this.db
      .update(contentPosts)
      .set({ linkPreview: preview })
      .where(eq(contentPosts.id, postId));
  }

  /**
   * Fan-out on read (ADR 0032): for each followed member, then each followed organization, the
   * newest `limit` publications through the partial feed indexes (LATERAL), merged and cut.
   * Each author costs at most `limit` index entries, whatever the size of the table.
   */
  async networkFeed(
    query: NetworkFeedQuery,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<FeedEntry[]> {
    const branches: SQL[] = [];
    if (query.memberAuthorIds.length > 0) {
      branches.push(sql`(select p.id, p.created_at from unnest(${uuidArray(query.memberAuthorIds)}) as author(id)
        cross join lateral (
          select p.id, p.created_at from ${contentPosts} p
          where p.author_id = author.id and p.deleted_at is null and p.organization_id is null
            and ${this.readable(query, after)}
          order by p.created_at desc, p.id desc
          limit ${limit}
        ) p)`);
    }
    if (query.organizationIds.length > 0) {
      branches.push(sql`(select p.id, p.created_at from unnest(${uuidArray(query.organizationIds)}) as organization(id)
        cross join lateral (
          select p.id, p.created_at from ${contentPosts} p
          where p.organization_id = organization.id and p.deleted_at is null
            and p.organization_id is not null
            and ${this.readable(query, after)}
          order by p.created_at desc, p.id desc
          limit ${limit}
        ) p)`);
    }
    if (branches.length === 0) return [];
    const result = await this.db.execute<{ id: string; created_at: Date | string }>(sql`
      select id, created_at from (${sql.join(branches, sql` union all `)}) feed
      order by created_at desc, id desc
      limit ${limit}`);
    return result.rows.map((row) => ({ id: row.id, createdAt: new Date(row.created_at) }));
  }

  async countNetworkFeed(query: NetworkFeedQuery, cap: number): Promise<number> {
    return (await this.networkFeed(query, null, cap)).length;
  }

  async featuredPosts(limit: number): Promise<{ id: string; featuredAt: Date | null }[]> {
    return this.db
      .select({ id: contentPosts.id, featuredAt: contentPosts.featuredAt })
      .from(contentPosts)
      .where(and(isNotNull(contentPosts.featuredAt), isNull(contentPosts.deletedAt)))
      .orderBy(desc(contentPosts.featuredAt))
      .limit(limit);
  }

  async featuredFeed(
    query: NetworkFeedQuery,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<{ id: string; featuredAt: Date }[]> {
    const rows = await this.db
      .select({ id: contentPosts.id, featuredAt: contentPosts.featuredAt })
      .from(contentPosts)
      .where(
        and(
          isNotNull(contentPosts.featuredAt),
          isNull(contentPosts.deletedAt),
          eq(contentPosts.moderationStatus, 'visible'),
          inArray(contentPosts.visibility, ['public', 'members']),
          query.memberAuthorIds.length > 0
            ? sql`not (${contentPosts.organizationId} is null and ${contentPosts.authorId} = any(${uuidArray(query.memberAuthorIds)}))`
            : undefined,
          query.organizationIds.length > 0
            ? sql`(${contentPosts.organizationId} is null or ${contentPosts.organizationId} <> all(${uuidArray(query.organizationIds)}))`
            : undefined,
          query.blockedUserIds.length > 0
            ? notInArray(contentPosts.authorId, [...query.blockedUserIds])
            : undefined,
          sql`not exists (select 1 from ${contentHiddenPosts} h where h.user_id = ${query.viewerId} and h.post_id = ${contentPosts.id})`,
          after
            ? sql`(${contentPosts.featuredAt}, ${contentPosts.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(contentPosts.featuredAt), desc(contentPosts.id))
      .limit(limit);
    return rows.flatMap((row) =>
      row.featuredAt ? [{ id: row.id, featuredAt: row.featuredAt }] : [],
    );
  }

  /** Conditions of a readable network publication for the reader, inside the LATERAL. */
  private readable(query: NetworkFeedQuery, after: KeysetPosition | null): SQL {
    const conditions: SQL[] = [
      sql`p.moderation_status = 'visible'`,
      sql`(p.visibility <> 'connections' or p.author_id = any(${uuidArray(query.connectionAuthorIds)}))`,
      sql`not exists (select 1 from ${contentHiddenPosts} h where h.user_id = ${query.viewerId} and h.post_id = p.id)`,
    ];
    if (query.blockedUserIds.length > 0) {
      conditions.push(sql`p.author_id <> all(${uuidArray(query.blockedUserIds)})`);
    }
    if (after) conditions.push(sql`(p.created_at, p.id) < (${after.at}, ${after.key}::uuid)`);
    return sql.join(conditions, sql` and `);
  }

  async projectPosts(
    projectId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<FeedEntry[]> {
    const rows = await this.db
      .select({ id: contentPosts.id, createdAt: contentPosts.createdAt })
      .from(contentPosts)
      .where(
        and(
          eq(contentPosts.projectId, projectId),
          isNull(contentPosts.deletedAt),
          eq(contentPosts.moderationStatus, 'visible'),
          after
            ? sql`(${contentPosts.createdAt}, ${contentPosts.id}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(contentPosts.createdAt), desc(contentPosts.id))
      .limit(limit);
    return rows;
  }

  async repostCounts(postIds: readonly string[]): Promise<Map<string, number>> {
    if (postIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: contentPosts.repostOfId, count: count() })
      .from(contentPosts)
      .where(and(inArray(contentPosts.repostOfId, [...postIds]), isNull(contentPosts.deletedAt)))
      .groupBy(contentPosts.repostOfId);
    return new Map(rows.flatMap((row) => (row.id ? [[row.id, row.count]] : [])));
  }

  async commentCounts(postIds: readonly string[]): Promise<Map<string, number>> {
    if (postIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: contentComments.postId, count: count() })
      .from(contentComments)
      .where(
        and(
          inArray(contentComments.postId, [...postIds]),
          isNull(contentComments.deletedAt),
          eq(contentComments.moderationStatus, 'visible'),
        ),
      )
      .groupBy(contentComments.postId);
    return new Map(rows.map((row) => [row.id, row.count]));
  }

  async findReaction(target: ReactionTarget, userId: string): Promise<ReactionType | null> {
    const [row] = await this.db
      .select({ type: contentReactions.type })
      .from(contentReactions)
      .where(
        and(
          eq(contentReactions.targetType, target.type),
          eq(contentReactions.targetId, target.id),
          eq(contentReactions.userId, userId),
        ),
      );
    return (row?.type as ReactionType | undefined) ?? null;
  }

  async setReaction(
    target: ReactionTarget,
    userId: string,
    type: ReactionType,
    at: Date,
  ): Promise<void> {
    await this.db
      .insert(contentReactions)
      .values({
        targetType: target.type,
        targetId: target.id,
        userId,
        type,
        createdAt: at,
        updatedAt: at,
      })
      .onConflictDoUpdate({
        target: [contentReactions.targetType, contentReactions.targetId, contentReactions.userId],
        set: { type, updatedAt: at },
      });
  }

  async deleteReaction(target: ReactionTarget, userId: string): Promise<void> {
    await this.db
      .delete(contentReactions)
      .where(
        and(
          eq(contentReactions.targetType, target.type),
          eq(contentReactions.targetId, target.id),
          eq(contentReactions.userId, userId),
        ),
      );
  }

  async reactionCounts(
    type: ReactionTarget['type'],
    ids: readonly string[],
  ): Promise<Map<string, ReactionCounts>> {
    const counts = new Map<string, ReactionCounts>();
    if (ids.length === 0) return counts;
    const rows = await this.db
      .select({ id: contentReactions.targetId, type: contentReactions.type, count: count() })
      .from(contentReactions)
      .where(
        and(eq(contentReactions.targetType, type), inArray(contentReactions.targetId, [...ids])),
      )
      .groupBy(contentReactions.targetId, contentReactions.type);
    for (const row of rows) {
      const entry = counts.get(row.id) ?? EMPTY_COUNTS();
      entry[row.type as ReactionType] = row.count;
      counts.set(row.id, entry);
    }
    return counts;
  }

  async viewerReactions(
    type: ReactionTarget['type'],
    ids: readonly string[],
    userId: string,
  ): Promise<Map<string, ReactionType>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ id: contentReactions.targetId, type: contentReactions.type })
      .from(contentReactions)
      .where(
        and(
          eq(contentReactions.targetType, type),
          inArray(contentReactions.targetId, [...ids]),
          eq(contentReactions.userId, userId),
        ),
      );
    return new Map(rows.map((row) => [row.id, row.type as ReactionType]));
  }

  async insertComment(comment: CommentRecord): Promise<void> {
    await this.db.insert(contentComments).values(comment);
  }

  async findComment(id: string): Promise<CommentRecord | null> {
    const [row] = await this.db.select().from(contentComments).where(eq(contentComments.id, id));
    return row ? toComment(row) : null;
  }

  async updateComment(id: string, patch: CommentPatch): Promise<void> {
    await this.db.update(contentComments).set(patch).where(eq(contentComments.id, id));
  }

  async comments(
    scope: { postId: string; parentId: string | null },
    after: KeysetPosition | null,
    limit: number,
    excludedAuthorIds: readonly string[],
  ): Promise<CommentRecord[]> {
    const rows = await this.db
      .select()
      .from(contentComments)
      .where(
        and(
          scope.parentId === null
            ? and(eq(contentComments.postId, scope.postId), isNull(contentComments.parentId))
            : eq(contentComments.parentId, scope.parentId),
          isNull(contentComments.deletedAt),
          eq(contentComments.moderationStatus, 'visible'),
          excludedAuthorIds.length > 0
            ? notInArray(contentComments.authorId, [...excludedAuthorIds])
            : undefined,
          after
            ? sql`(${contentComments.createdAt}, ${contentComments.id}) > (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(asc(contentComments.createdAt), asc(contentComments.id))
      .limit(limit);
    return rows.map(toComment);
  }

  async replyCounts(commentIds: readonly string[]): Promise<Map<string, number>> {
    if (commentIds.length === 0) return new Map();
    const rows = await this.db
      .select({ id: contentComments.parentId, count: count() })
      .from(contentComments)
      .where(
        and(
          inArray(contentComments.parentId, [...commentIds]),
          isNull(contentComments.deletedAt),
          eq(contentComments.moderationStatus, 'visible'),
        ),
      )
      .groupBy(contentComments.parentId);
    return new Map(rows.flatMap((row) => (row.id ? [[row.id, row.count]] : [])));
  }

  async savePost(userId: string, postId: string, at: Date): Promise<boolean> {
    const inserted = await this.db
      .insert(contentSavedPosts)
      .values({ userId, postId, savedAt: at })
      .onConflictDoNothing()
      .returning({ postId: contentSavedPosts.postId });
    return inserted.length > 0;
  }

  async unsavePost(userId: string, postId: string): Promise<void> {
    await this.db
      .delete(contentSavedPosts)
      .where(and(eq(contentSavedPosts.userId, userId), eq(contentSavedPosts.postId, postId)));
  }

  async savedFlags(userId: string, postIds: readonly string[]): Promise<Set<string>> {
    if (postIds.length === 0) return new Set();
    const rows = await this.db
      .select({ postId: contentSavedPosts.postId })
      .from(contentSavedPosts)
      .where(
        and(eq(contentSavedPosts.userId, userId), inArray(contentSavedPosts.postId, [...postIds])),
      );
    return new Set(rows.map((row) => row.postId));
  }

  async savedPosts(
    userId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<{ postId: string; savedAt: Date }[]> {
    return this.db
      .select({ postId: contentSavedPosts.postId, savedAt: contentSavedPosts.savedAt })
      .from(contentSavedPosts)
      .where(
        and(
          eq(contentSavedPosts.userId, userId),
          after
            ? sql`(${contentSavedPosts.savedAt}, ${contentSavedPosts.postId}) < (${after.at}, ${after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(contentSavedPosts.savedAt), desc(contentSavedPosts.postId))
      .limit(limit);
  }

  async hidePost(userId: string, postId: string, at: Date): Promise<void> {
    await this.db
      .insert(contentHiddenPosts)
      .values({ userId, postId, hiddenAt: at })
      .onConflictDoNothing();
  }

  async unhidePost(userId: string, postId: string): Promise<void> {
    await this.db
      .delete(contentHiddenPosts)
      .where(and(eq(contentHiddenPosts.userId, userId), eq(contentHiddenPosts.postId, postId)));
  }

  async upsertDailyViews(
    rows: readonly { postId: string; day: string; uniqueViewers: number }[],
    at: Date,
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.db
      .insert(contentPostDailyViews)
      .values(rows.map((row) => ({ ...row, updatedAt: at })))
      .onConflictDoUpdate({
        target: [contentPostDailyViews.postId, contentPostDailyViews.day],
        set: { uniqueViewers: sql`excluded.unique_viewers`, updatedAt: at },
      });
  }

  async dailyViews(postId: string): Promise<{ day: string; uniqueViewers: number }[]> {
    return this.db
      .select({
        day: contentPostDailyViews.day,
        uniqueViewers: contentPostDailyViews.uniqueViewers,
      })
      .from(contentPostDailyViews)
      .where(eq(contentPostDailyViews.postId, postId))
      .orderBy(asc(contentPostDailyViews.day));
  }
}

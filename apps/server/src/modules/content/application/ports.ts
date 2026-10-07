import type { ProjectUpdateFeedEntry, ReactionCounts, ReactionType } from '@pitchorium/contracts';
import type { KeysetPosition } from '../../../platform/kernel';
import type { CommentRecord } from '../domain/comment';
import type { ResolvedMention } from '../domain/mentions';
import type { LinkPreviewState, PostRecord } from '../domain/post';

export type PostPatch = Partial<
  Pick<
    PostRecord,
    | 'text'
    | 'language'
    | 'languageSource'
    | 'visibility'
    | 'linkPreview'
    | 'commentsDisabled'
    | 'moderationStatus'
    | 'featuredAt'
    | 'featuredBy'
    | 'editedAt'
    | 'deletedAt'
  >
>;

export type CommentPatch = Partial<
  Pick<CommentRecord, 'text' | 'moderationStatus' | 'editedAt' | 'deletedAt'>
>;

export type ReactionTarget = { type: 'post' | 'comment'; id: string };

/** What the network feed of a reader is made of (ADR 0032). */
export interface NetworkFeedQuery {
  viewerId: string;
  /** Followed members and the reader, without the members on either side of a block. */
  memberAuthorIds: readonly string[];
  organizationIds: readonly string[];
  /** Authors whose `connections` publications the reader sees: connections and the reader. */
  connectionAuthorIds: readonly string[];
  blockedUserIds: readonly string[];
}

export interface FeedEntry {
  id: string;
  createdAt: Date;
}

export abstract class ContentRepository {
  abstract lock(key: string): Promise<void>;

  abstract insertPost(post: PostRecord): Promise<void>;
  abstract findPost(id: string): Promise<PostRecord | null>;
  abstract findPosts(ids: readonly string[]): Promise<PostRecord[]>;
  abstract updatePost(id: string, patch: PostPatch): Promise<void>;
  abstract replaceMentions(postId: string, mentions: readonly ResolvedMention[]): Promise<void>;
  abstract mentionsOf(postIds: readonly string[]): Promise<Map<string, ResolvedMention[]>>;
  /** Live public publications of a member written in their own name. */
  abstract publicPostIdsOfMember(authorId: string): Promise<string[]>;
  abstract postsWithPreviewImage(mediaId: string): Promise<PostRecord[]>;
  abstract setPreview(postId: string, preview: LinkPreviewState): Promise<void>;

  /** Newest network publications, at most `limit`, after the keyset position. */
  abstract networkFeed(
    query: NetworkFeedQuery,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<FeedEntry[]>;
  /** Network publications counted up to `cap` (editorial complement threshold). */
  abstract countNetworkFeed(query: NetworkFeedQuery, cap: number): Promise<number>;
  /** Editorial highlights for the reader, newest highlight first, outside their network. */
  abstract featuredFeed(
    query: NetworkFeedQuery,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<{ id: string; featuredAt: Date }[]>;

  /** Live publications attached to a project, newest first, after the keyset position. */
  abstract projectPosts(
    projectId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<FeedEntry[]>;

  abstract repostCounts(postIds: readonly string[]): Promise<Map<string, number>>;
  abstract commentCounts(postIds: readonly string[]): Promise<Map<string, number>>;

  abstract findReaction(target: ReactionTarget, userId: string): Promise<ReactionType | null>;
  abstract setReaction(
    target: ReactionTarget,
    userId: string,
    type: ReactionType,
    at: Date,
  ): Promise<void>;
  abstract deleteReaction(target: ReactionTarget, userId: string): Promise<void>;
  abstract reactionCounts(
    type: ReactionTarget['type'],
    ids: readonly string[],
  ): Promise<Map<string, ReactionCounts>>;
  abstract viewerReactions(
    type: ReactionTarget['type'],
    ids: readonly string[],
    userId: string,
  ): Promise<Map<string, ReactionType>>;

  abstract insertComment(comment: CommentRecord): Promise<void>;
  abstract findComment(id: string): Promise<CommentRecord | null>;
  abstract updateComment(id: string, patch: CommentPatch): Promise<void>;
  /** Visible comments, oldest first, after the keyset position. */
  abstract comments(
    scope: { postId: string; parentId: null } | { postId: string; parentId: string },
    after: KeysetPosition | null,
    limit: number,
    excludedAuthorIds: readonly string[],
  ): Promise<CommentRecord[]>;
  abstract replyCounts(commentIds: readonly string[]): Promise<Map<string, number>>;

  /** False when it was already saved. */
  abstract savePost(userId: string, postId: string, at: Date): Promise<boolean>;
  abstract unsavePost(userId: string, postId: string): Promise<void>;
  abstract savedFlags(userId: string, postIds: readonly string[]): Promise<Set<string>>;
  abstract savedPosts(
    userId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<{ postId: string; savedAt: Date }[]>;
  abstract hidePost(userId: string, postId: string, at: Date): Promise<void>;
  abstract unhidePost(userId: string, postId: string): Promise<void>;

  abstract upsertDailyViews(
    rows: readonly { postId: string; day: string; uniqueViewers: number }[],
    at: Date,
  ): Promise<void>;
  abstract dailyViews(postId: string): Promise<{ day: string; uniqueViewers: number }[]>;
}

/** Port: language of a text (ISO 639-1), null when undetermined. */
export abstract class LanguageDetector {
  abstract detect(text: string): string | null;
}

export class LinkPreviewRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinkPreviewRefusedError';
  }
}

/** Port: HTML of a linked page, through the SSRF-protected client (ADR 0033). */
export abstract class LinkPageFetcher {
  /** Throws LinkPreviewRefusedError for a refused or failed fetch. */
  abstract fetchHtml(url: string): Promise<{ html: string; finalUrl: string }>;
}

/**
 * Port: approximate count of unique members who saw a publication each day (HyperLogLog,
 * ADR 0034). `record` never waits for nor reports an error.
 */
export abstract class PostViewCounter {
  abstract record(viewerId: string, postIds: readonly string[], day: string): void;
  abstract postIdsSeen(day: string): Promise<string[]>;
  abstract count(day: string, postIds: readonly string[]): Promise<Map<string, number>>;
}

/**
 * Validates the project a publication is attached to; provided by the projects module.
 * Until then, the default adapter refuses every project.
 */
export interface ProjectLinkValidator {
  canAttach(projectId: string, authorId: string): Promise<boolean>;
}

/**
 * Updates of the projects a reader follows, provided by the projects module and merged into
 * the network part of the feed (`project_update` items). Until it is registered, the feed has
 * no project update.
 */
export interface ProjectUpdatesFeedSource {
  /** Newest first, strictly before the keyset position, at most `limit`. */
  entries(viewerId: string, after: KeysetPosition | null, limit: number): Promise<FeedEntry[]>;
  /** Views of the updates the reader may see, by id. */
  present(viewerId: string, ids: readonly string[]): Promise<Map<string, ProjectUpdateFeedEntry>>;
}

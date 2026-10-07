import { Injectable } from '@nestjs/common';
import type {
  ReactionType,
  Comment,
  CreateCommentRequest,
  CursorPage,
  CursorPageQuery,
} from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import {
  Clock,
  DomainError,
  decodeKeyset,
  encodeKeyset,
  IdGenerator,
} from '../../../platform/kernel';
import { ProfilesFacade } from '../../profiles';
import {
  assertCommentsOpen,
  assertReplyable,
  type CommentRecord,
  isCommentVisible,
} from '../domain/comment';
import { CommentCreated, CommentDeleted, CommentUpdated } from '../domain/content-events';
import { ContentEventsRecorder } from './content-events.recorder';
import { ContentRepository } from './ports';
import { memberCardView, PostPresenter, type Reader, reactionSummary } from './post-presenter';
import { PostsService } from './posts.service';

const notFound = () => new DomainError('CONTENT_COMMENT_NOT_FOUND', 'Comment not found');

/** Comments and replies, one level of nesting (§10.3). */
@Injectable()
export class CommentsService {
  constructor(
    private readonly content: ContentRepository,
    private readonly posts: PostsService,
    private readonly presenter: PostPresenter,
    private readonly profiles: ProfilesFacade,
    private readonly events: ContentEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async create(userId: string, postId: string, body: CreateCommentRequest): Promise<Comment> {
    const reader = await this.presenter.reader(userId);
    const post = await this.posts.readable(reader, postId);
    assertCommentsOpen(post);
    const parent = body.parentId
      ? assertReplyable(await this.content.findComment(body.parentId), post.id)
      : null;
    if (parent && reader.blocked.has(parent.authorId)) throw notFound();
    const comment: CommentRecord = {
      id: this.ids.next(),
      postId: post.id,
      parentId: parent?.id ?? null,
      authorId: userId,
      text: body.text,
      moderationStatus: 'visible',
      createdAt: this.clock.now(),
      editedAt: null,
      deletedAt: null,
    };
    await this.transactions.run(async () => {
      await this.content.insertComment(comment);
      await this.events.record(CommentCreated, comment.id, {
        postId: post.id,
        authorId: userId,
        parentId: comment.parentId,
        postAuthorId: post.authorId,
      });
    });
    const [view] = await this.present(reader, [comment], post.authorId);
    if (!view) throw notFound();
    return view;
  }

  /** Edition by its author (resolver ownership). */
  async update(userId: string, commentId: string, text: string): Promise<Comment> {
    const comment = await this.live(commentId);
    const post = await this.content.findPost(comment.postId);
    if (!post || comment.authorId !== userId) throw notFound();
    const editedAt = this.clock.now();
    await this.transactions.run(async () => {
      await this.content.updateComment(comment.id, { text, editedAt });
      await this.events.record(CommentUpdated, comment.id, {
        postId: comment.postId,
        authorId: comment.authorId,
        parentId: comment.parentId,
        postAuthorId: post.authorId,
      });
    });
    const [view] = await this.present(
      await this.presenter.reader(userId),
      [{ ...comment, text, editedAt }],
      post.authorId,
    );
    if (!view) throw notFound();
    return view;
  }

  /** Deletion by its author or the author of the publication (resolver roles). */
  async delete(userId: string, commentId: string): Promise<void> {
    const comment = await this.live(commentId);
    const post = await this.content.findPost(comment.postId);
    if (!post) throw notFound();
    await this.transactions.run(async () => {
      await this.content.updateComment(comment.id, { deletedAt: this.clock.now() });
      await this.events.record(CommentDeleted, comment.id, {
        postId: comment.postId,
        authorId: comment.authorId,
        parentId: comment.parentId,
        postAuthorId: post.authorId,
        deletedBy: userId,
      });
    });
  }

  /** Top-level comments of a publication, oldest first. */
  async list(userId: string, postId: string, query: CursorPageQuery): Promise<CursorPage<Comment>> {
    const reader = await this.presenter.reader(userId);
    const post = await this.posts.readable(reader, postId);
    return this.page(reader, { postId: post.id, parentId: null }, post.authorId, query);
  }

  async replies(
    userId: string,
    commentId: string,
    query: CursorPageQuery,
  ): Promise<CursorPage<Comment>> {
    const reader = await this.presenter.reader(userId);
    const parent = await this.live(commentId);
    const post = await this.posts.readable(reader, parent.postId);
    return this.page(reader, { postId: post.id, parentId: parent.id }, post.authorId, query);
  }

  /** A visible comment; its publication must be readable by the caller's checks. */
  async live(commentId: string): Promise<CommentRecord> {
    const comment = await this.content.findComment(commentId);
    if (!comment || !isCommentVisible(comment)) throw notFound();
    return comment;
  }

  private async page(
    reader: Reader,
    scope: { postId: string; parentId: string | null },
    postAuthorId: string,
    query: CursorPageQuery,
  ): Promise<CursorPage<Comment>> {
    const rows = await this.content.comments(scope, decodeKeyset(query.cursor), query.limit + 1, [
      ...reader.blocked,
    ]);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: await this.present(reader, page, postAuthorId),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.createdAt, key: last.id })
          : null,
    };
  }

  private async present(
    reader: Reader,
    comments: readonly CommentRecord[],
    postAuthorId: string,
  ): Promise<Comment[]> {
    const ids = comments.map((comment) => comment.id);
    const viewerId = reader.viewerId;
    const [cards, reactions, viewerReactions, replies] = await Promise.all([
      this.profiles.memberCards(
        comments.map((comment) => comment.authorId),
        reader.viewerId,
      ),
      this.content.reactionCounts('comment', ids),
      viewerId
        ? this.content.viewerReactions('comment', ids, viewerId)
        : new Map<string, ReactionType>(),
      this.content.replyCounts(ids),
    ]);
    return comments.flatMap((comment): Comment[] => {
      const card = cards.get(comment.authorId);
      if (!card) return [];
      return [
        {
          id: comment.id,
          postId: comment.postId,
          parentId: comment.parentId,
          author: memberCardView(card),
          text: comment.text,
          reactions: reactionSummary(reactions.get(comment.id), viewerReactions.get(comment.id)),
          replyCount: replies.get(comment.id) ?? 0,
          viewerIsAuthor: viewerId === comment.authorId,
          viewerCanDelete: viewerId === comment.authorId || viewerId === postAuthorId,
          createdAt: comment.createdAt.toISOString(),
          editedAt: comment.editedAt?.toISOString() ?? null,
        },
      ];
    });
  }
}

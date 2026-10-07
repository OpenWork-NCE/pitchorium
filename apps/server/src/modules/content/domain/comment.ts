import type { ContentModerationStatus } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

export interface CommentRecord {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  text: string;
  moderationStatus: ContentModerationStatus;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}

export function assertCommentsOpen(post: { commentsDisabled: boolean }): void {
  if (post.commentsDisabled) {
    throw new DomainError('CONTENT_COMMENTS_DISABLED', 'Comments are disabled');
  }
}

/** One level of nesting: a reply answers a live top-level comment of the same publication. */
export function assertReplyable(parent: CommentRecord | null, postId: string): CommentRecord {
  if (!parent || parent.postId !== postId || parent.deletedAt) {
    throw new DomainError('CONTENT_COMMENT_NOT_FOUND', 'Comment not found');
  }
  if (parent.parentId !== null) {
    throw new DomainError('CONTENT_REPLY_DEPTH', 'Replies answer top-level comments only');
  }
  return parent;
}

/** Roles of a member on a comment, for the access policies: its author, the post's author. */
export function commentRoles(
  comment: Pick<CommentRecord, 'authorId'>,
  postAuthorId: string,
  viewerId: string,
): string[] {
  return [
    ...(comment.authorId === viewerId ? ['author'] : []),
    ...(postAuthorId === viewerId ? ['post_author'] : []),
  ];
}

export function isCommentVisible(comment: CommentRecord): boolean {
  return comment.deletedAt === null && comment.moderationStatus === 'visible';
}

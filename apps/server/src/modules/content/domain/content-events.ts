import type { ReactionType } from '@pitchorium/contracts';
import { DomainEvent, type DomainEventProps } from '../../../platform/kernel';

/**
 * Content events, for notifications (§10.5): identifiers and codes only, never texts. Post and
 * mention events have the publication as aggregate, comment events the comment, reaction events
 * the target.
 */
abstract class PostEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'post';
}

abstract class CommentEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'comment';
}

abstract class ReactionEvent<P extends DomainEvent['payload']> extends DomainEvent<P> {
  readonly aggregateType = 'reaction_target';
}

/**
 * The composer asked for the preview of a link (ADR 0118): the worker builds it. Internal to
 * the module, never notified.
 */
export class LinkPreviewRequested extends DomainEvent<{ ownerId: string }> {
  static readonly TYPE = 'content.link-preview.requested.v1';
  readonly type = LinkPreviewRequested.TYPE;
  readonly aggregateType = 'link_preview';
  constructor(props: DomainEventProps<LinkPreviewRequested['payload']>) {
    super(props);
  }
}

export class PostCreated extends PostEvent<{
  authorId: string;
  organizationId: string | null;
  visibility: string;
  hasLink: boolean;
}> {
  static readonly TYPE = 'content.post.created.v1';
  readonly type = PostCreated.TYPE;
  constructor(props: DomainEventProps<PostCreated['payload']>) {
    super(props);
  }
}

/** Lists the changed field names (`text`, `visibility`, `language`, `commentsDisabled`). */
export class PostUpdated extends PostEvent<{ authorId: string; fields: string[] }> {
  static readonly TYPE = 'content.post.updated.v1';
  readonly type = PostUpdated.TYPE;
  constructor(props: DomainEventProps<PostUpdated['payload']>) {
    super(props);
  }
}

export class PostDeleted extends PostEvent<{ authorId: string }> {
  static readonly TYPE = 'content.post.deleted.v1';
  readonly type = PostDeleted.TYPE;
  constructor(props: DomainEventProps<PostDeleted['payload']>) {
    super(props);
  }
}

/** Aggregate: the repost; `repostOfId` is the original and `originalAuthorId` its author. */
export class PostReposted extends PostEvent<{
  authorId: string;
  repostOfId: string;
  originalAuthorId: string;
}> {
  static readonly TYPE = 'content.post.reposted.v1';
  readonly type = PostReposted.TYPE;
  constructor(props: DomainEventProps<PostReposted['payload']>) {
    super(props);
  }
}

export class MentionCreated extends PostEvent<{
  authorId: string;
  targetType: string;
  targetId: string;
}> {
  static readonly TYPE = 'content.mention.created.v1';
  readonly type = MentionCreated.TYPE;
  constructor(props: DomainEventProps<MentionCreated['payload']>) {
    super(props);
  }
}

type ReactionPayload = {
  userId: string;
  targetType: 'post' | 'comment';
  /** Author of the publication or comment reacted to. */
  targetAuthorId: string;
};

export class ReactionAdded extends ReactionEvent<ReactionPayload & { reaction: ReactionType }> {
  static readonly TYPE = 'content.reaction.added.v1';
  readonly type = ReactionAdded.TYPE;
  constructor(props: DomainEventProps<ReactionAdded['payload']>) {
    super(props);
  }
}

export class ReactionChanged extends ReactionEvent<
  ReactionPayload & { reaction: ReactionType; previous: ReactionType }
> {
  static readonly TYPE = 'content.reaction.changed.v1';
  readonly type = ReactionChanged.TYPE;
  constructor(props: DomainEventProps<ReactionChanged['payload']>) {
    super(props);
  }
}

export class ReactionRemoved extends ReactionEvent<ReactionPayload & { previous: ReactionType }> {
  static readonly TYPE = 'content.reaction.removed.v1';
  readonly type = ReactionRemoved.TYPE;
  constructor(props: DomainEventProps<ReactionRemoved['payload']>) {
    super(props);
  }
}

type CommentPayload = {
  postId: string;
  authorId: string;
  parentId: string | null;
  postAuthorId: string;
};

export class CommentCreated extends CommentEvent<CommentPayload> {
  static readonly TYPE = 'content.comment.created.v1';
  readonly type = CommentCreated.TYPE;
  constructor(props: DomainEventProps<CommentCreated['payload']>) {
    super(props);
  }
}

export class CommentUpdated extends CommentEvent<CommentPayload> {
  static readonly TYPE = 'content.comment.updated.v1';
  readonly type = CommentUpdated.TYPE;
  constructor(props: DomainEventProps<CommentUpdated['payload']>) {
    super(props);
  }
}

export class CommentDeleted extends CommentEvent<CommentPayload & { deletedBy: string }> {
  static readonly TYPE = 'content.comment.deleted.v1';
  readonly type = CommentDeleted.TYPE;
  constructor(props: DomainEventProps<CommentDeleted['payload']>) {
    super(props);
  }
}

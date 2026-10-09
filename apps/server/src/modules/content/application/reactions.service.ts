import { Injectable } from '@nestjs/common';
import type {
  CursorPage,
  CursorPageQuery,
  Reactor,
  ReactionSummary,
  ReactionType,
} from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, decodeKeyset, encodeKeyset } from '../../../platform/kernel';
import { ProfilesFacade } from '../../profiles';
import { ReactionAdded, ReactionChanged, ReactionRemoved } from '../domain/content-events';
import { reactionChange } from '../domain/reactions';
import { CommentsService } from './comments.service';
import { ContentEventsRecorder } from './content-events.recorder';
import { ContentRepository, type ReactionTarget } from './ports';
import { PostPresenter, reactionSummary } from './post-presenter';
import { PostsService } from './posts.service';

/** Professional reactions on publications and comments, one per member and target (§10.3). */
@Injectable()
export class ReactionsService {
  constructor(
    private readonly content: ContentRepository,
    private readonly posts: PostsService,
    private readonly comments: CommentsService,
    private readonly presenter: PostPresenter,
    private readonly events: ContentEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    private readonly profiles: ProfilesFacade,
  ) {}

  /**
   * Who reacted to a publication the reader may see, newest first, by reaction or all: members on
   * either side of a block with the reader are left out, as are members the reader may not see.
   */
  async reactors(
    userId: string,
    postId: string,
    type: ReactionType | null,
    query: CursorPageQuery,
  ): Promise<CursorPage<Reactor>> {
    const reader = await this.presenter.reader(userId);
    await this.posts.readable(reader, postId);
    const rows = await this.content.reactors(
      { type: 'post', id: postId },
      type,
      [...reader.blocked],
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const cards = await this.profiles.memberCards(
      page.map((row) => row.userId),
      userId,
    );
    const last = page.at(-1);
    return {
      items: page.flatMap((row) => {
        const card = cards.get(row.userId);
        return card
          ? [
              {
                member: {
                  handle: card.handle,
                  displayName: card.displayName,
                  headline: card.headline,
                  avatarUrl: card.avatarUrl,
                },
                type: row.type,
                reactedAt: row.at.toISOString(),
              },
            ]
          : [];
      }),
      nextCursor:
        rows.length > query.limit && last ? encodeKeyset({ at: last.at, key: last.userId }) : null,
    };
  }

  /** `type` null removes the reaction. */
  async react(
    userId: string,
    target: ReactionTarget,
    type: ReactionType | null,
  ): Promise<ReactionSummary> {
    const targetAuthorId = await this.targetAuthor(userId, target);
    await this.transactions.run(async () => {
      await this.content.lock(`content:reaction:${target.type}:${target.id}:${userId}`);
      const previous = await this.content.findReaction(target, userId);
      const change = reactionChange(previous, type);
      const base = { userId, targetType: target.type, targetAuthorId };
      if (change === 'unchanged') return;
      if (type === null) {
        await this.content.deleteReaction(target, userId);
      } else {
        await this.content.setReaction(target, userId, type, this.clock.now());
      }
      if (change === 'added' && type) {
        await this.events.record(ReactionAdded, target.id, { ...base, reaction: type });
      } else if (change === 'changed' && type && previous) {
        await this.events.record(ReactionChanged, target.id, { ...base, reaction: type, previous });
      } else if (change === 'removed' && previous) {
        await this.events.record(ReactionRemoved, target.id, { ...base, previous });
      }
    });
    const [counts, mine] = await Promise.all([
      this.content.reactionCounts(target.type, [target.id]),
      this.content.viewerReactions(target.type, [target.id], userId),
    ]);
    return reactionSummary(counts.get(target.id), mine.get(target.id));
  }

  /** The target must be readable; a block with its author hides it (404). */
  private async targetAuthor(userId: string, target: ReactionTarget): Promise<string> {
    const reader = await this.presenter.reader(userId);
    if (target.type === 'post') return (await this.posts.readable(reader, target.id)).authorId;
    const comment = await this.comments.live(target.id);
    await this.posts.readable(reader, comment.postId);
    if (reader.blocked.has(comment.authorId)) {
      throw new DomainError('CONTENT_COMMENT_NOT_FOUND', 'Comment not found');
    }
    return comment.authorId;
  }
}

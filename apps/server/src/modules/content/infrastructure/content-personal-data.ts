import { Injectable, type OnModuleInit } from '@nestjs/common';
import { and, eq, sql } from '@pitchorium/db/orm';
import {
  contentComments,
  contentHiddenPosts,
  contentLinkPreviews,
  contentPostMentions,
  contentPosts,
  contentReactions,
  contentSavedPosts,
} from '@pitchorium/db/schemas/content';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';

/**
 * Personal data of content: publications, comments, reactions, saved and hidden publications.
 * The erasure deletes them; a comment that others answered becomes an empty tombstone under
 * the pseudonym, so that their answers keep their thread. Files go with the media erasure.
 */
@Injectable()
export class ContentPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'content',
      description:
        'Your publications and reposts, your comments and answers, your reactions, and the publications you saved or hid.',
      order: ERASURE_ORDER.contents,
      exporter: {
        export: async (userId) => ({
          data: {
            posts: await this.db
              .select()
              .from(contentPosts)
              .where(eq(contentPosts.authorId, userId)),
            comments: await this.db
              .select()
              .from(contentComments)
              .where(eq(contentComments.authorId, userId)),
            reactions: await this.db
              .select()
              .from(contentReactions)
              .where(eq(contentReactions.userId, userId)),
            saved: await this.db
              .select()
              .from(contentSavedPosts)
              .where(eq(contentSavedPosts.userId, userId)),
            hidden: await this.db
              .select()
              .from(contentHiddenPosts)
              .where(eq(contentHiddenPosts.userId, userId)),
          },
        }),
      },
      eraser: { erase: ({ userId, pseudonym }) => this.erase(userId, pseudonym) },
    });
  }

  private async erase(userId: string, pseudonym: string): Promise<void> {
    const db = this.db;
    const now = this.clock.now();
    await db.delete(contentReactions).where(eq(contentReactions.userId, userId));
    // Reactions to the contents about to disappear.
    await db.execute(sql`
      delete from content.reactions r
      where (r.target_type = 'post' and r.target_id in (select id from content.posts where author_id = ${userId}))
         or (r.target_type = 'comment' and r.target_id in (select id from content.comments where author_id = ${userId}))`);
    await db.delete(contentSavedPosts).where(eq(contentSavedPosts.userId, userId));
    await db.delete(contentHiddenPosts).where(eq(contentHiddenPosts.userId, userId));
    await db.delete(contentLinkPreviews).where(eq(contentLinkPreviews.ownerId, userId));
    await db
      .delete(contentPostMentions)
      .where(
        and(eq(contentPostMentions.targetType, 'member'), eq(contentPostMentions.targetId, userId)),
      );
    // Comments without answers are deleted, deepest first; answered ones become tombstones.
    for (let round = 0; round < 10; round += 1) {
      const deleted = await db.execute(sql`
        delete from content.comments c
        where c.author_id = ${userId}
          and not exists (select 1 from content.comments child where child.parent_id = c.id)`);
      if ((deleted.rowCount ?? 0) === 0) break;
    }
    await db
      .update(contentComments)
      .set({
        text: '',
        authorId: pseudonym,
        deletedAt: sql`coalesce(${contentComments.deletedAt}, ${now})`,
      })
      .where(eq(contentComments.authorId, userId));
    // Reposts by others lose the link to a deleted publication, then the publications go,
    // with their comments, mentions, saves and statistics (cascade).
    await db.execute(sql`
      update content.posts set repost_of_id = null
      where author_id <> ${userId}
        and repost_of_id in (select id from content.posts where author_id = ${userId})`);
    await db.delete(contentPosts).where(eq(contentPosts.authorId, userId));
    await replaceIdentifier(
      db,
      [{ table: 'content.posts', column: 'featured_by' }],
      userId,
      pseudonym,
    );
  }
}

import { Injectable } from '@nestjs/common';
import { AuditService } from '../../../platform/audit';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError } from '../../../platform/kernel';
import { ProfilesFacade } from '../../profiles';
import { effectiveVisibility } from '../domain/post';
import { ContentRepository } from './ports';

const notFound = () => new DomainError('CONTENT_POST_NOT_FOUND', 'Publication not found');

/**
 * Editorial highlight of a publication by a moderator or an administrator (ADR 0032), through
 * the administration (`/v1/admin/highlights`); a connections-only publication is never featured.
 */
@Injectable()
export class PostHighlightsService {
  constructor(
    private readonly content: ContentRepository,
    private readonly profiles: ProfilesFacade,
    private readonly audit: AuditService,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  async setFeatured(postId: string, actorId: string, featured: boolean): Promise<void> {
    const post = await this.content.findPost(postId);
    if (!post || post.deletedAt || post.moderationStatus !== 'visible') throw notFound();
    const card = (await this.profiles.memberCards([post.authorId])).get(post.authorId);
    if (featured && effectiveVisibility(post, card?.publicPageEnabled ?? false) === 'connections') {
      throw new DomainError(
        'CONTENT_VISIBILITY_NOT_ALLOWED',
        'A connections-only publication cannot be featured',
      );
    }
    const now = this.clock.now();
    await this.transactions.run(async () => {
      await this.content.updatePost(post.id, {
        featuredAt: featured ? now : null,
        featuredBy: featured ? actorId : null,
      });
      await this.audit.record({
        actor: { type: 'user', id: actorId },
        action: featured ? 'content.post-featured' : 'content.post-unfeatured',
        target: { type: 'post', id: post.id },
      });
    });
  }

  /** Live featured publications, latest first. */
  featured(limit: number): Promise<{ id: string; featuredAt: Date | null }[]> {
    return this.content.featuredPosts(limit);
  }
}

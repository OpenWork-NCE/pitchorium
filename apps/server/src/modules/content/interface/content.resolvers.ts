import { Injectable } from '@nestjs/common';
import { uuidV7Schema } from '@pitchorium/contracts';
import type { Request } from 'express';
import type { Principal, ProtectedResource, ResourceResolver } from '../../../platform/http';
import { commentRoles } from '../domain/comment';
import { ContentRepository } from '../application/ports';
import { PostPresenter } from '../application/post-presenter';

/**
 * Resource of the `:postId` routes reserved to the author: a live publication. Unknown, or
 * hidden from the principal: 404, so that its existence does not leak (ASVS V4.2.1).
 */
@Injectable()
export class PostResolver implements ResourceResolver {
  constructor(
    private readonly content: ContentRepository,
    private readonly presenter: PostPresenter,
  ) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = uuidV7Schema.safeParse(request.params['postId']);
    if (!id.success) return null;
    const post = await this.content.findPost(id.data);
    if (!post || post.deletedAt) return null;
    if (
      post.authorId !== principal.userId &&
      !(await this.presenter.canRead(await this.presenter.reader(principal.userId), post))
    ) {
      return null;
    }
    return { type: 'post', id: post.id, ownerId: post.authorId };
  }
}

/**
 * Resource of the `:commentId` routes: a live comment, owned by its author, with the roles of
 * the principal (`author`, `post_author`) for the deletion policy.
 */
@Injectable()
export class CommentResolver implements ResourceResolver {
  constructor(private readonly content: ContentRepository) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = uuidV7Schema.safeParse(request.params['commentId']);
    if (!id.success) return null;
    const comment = await this.content.findComment(id.data);
    if (!comment || comment.deletedAt) return null;
    const post = await this.content.findPost(comment.postId);
    if (!post || post.deletedAt) return null;
    return {
      type: 'comment',
      id: comment.id,
      ownerId: comment.authorId,
      roles: commentRoles(comment, post.authorId, principal.userId),
    };
  }
}

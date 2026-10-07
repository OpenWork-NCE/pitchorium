import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { ContentModerationStatus } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import { MediaFacade } from '../../media';
import { ContentRepository, type ProjectLinkValidator } from './ports';
import { PostPresenter } from './post-presenter';
import { POST_RESOURCE } from './posts.service';
import { ProjectLinkRegistry } from './project-link.registry';

/**
 * Public facade of the content module: moderation for trust, the project link for projects.
 * At startup it gives media the read rule of the private files of publications.
 */
@Injectable()
export class ContentFacade implements OnModuleInit {
  constructor(
    private readonly content: ContentRepository,
    private readonly presenter: PostPresenter,
    private readonly media: MediaFacade,
    private readonly projects: ProjectLinkRegistry,
  ) {}

  onModuleInit(): void {
    // Documents and private images of a publication are read by whoever may see it.
    this.media.registerReadAuthorizer({
      resourceTypes: [POST_RESOURCE],
      canRead: async (viewerId, resource) => {
        const post = await this.content.findPost(resource.id);
        return post !== null && this.presenter.canRead(await this.presenter.reader(viewerId), post);
      },
    });
  }

  async setPostModerationStatus(postId: string, status: ContentModerationStatus): Promise<void> {
    if (!(await this.content.findPost(postId))) {
      throw new DomainError('CONTENT_POST_NOT_FOUND', 'Publication not found');
    }
    await this.content.updatePost(postId, { moderationStatus: status });
  }

  async setCommentModerationStatus(
    commentId: string,
    status: ContentModerationStatus,
  ): Promise<void> {
    if (!(await this.content.findComment(commentId))) {
      throw new DomainError('CONTENT_COMMENT_NOT_FOUND', 'Comment not found');
    }
    await this.content.updateComment(commentId, { moderationStatus: status });
  }

  /** Called at startup by the projects module. */
  registerProjectLinkValidator(validator: ProjectLinkValidator): void {
    this.projects.register(validator);
  }
}

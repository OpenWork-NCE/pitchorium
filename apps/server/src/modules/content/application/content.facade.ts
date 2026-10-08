import { Injectable, type OnModuleInit } from '@nestjs/common';
import type {
  ContentModerationStatus,
  CursorPage,
  CursorPageQuery,
  Post,
} from '@pitchorium/contracts';
import { decodeKeyset, DomainError, encodeKeyset } from '../../../platform/kernel';
import { MediaFacade } from '../../media';
import {
  ContentRepository,
  type ProjectLinkValidator,
  type ProjectUpdatesFeedSource,
} from './ports';
import { ANONYMOUS_READER, PostPresenter } from './post-presenter';
import { POST_RESOURCE } from './posts.service';
import {
  type EventsFeedSource,
  type FeedSuggestionSource,
  FeedSourcesRegistry,
} from './feed-sources.registry';
import { PostHighlightsService } from './post-highlights.service';
import { ProjectLinkRegistry } from './project-link.registry';

/**
 * Public facade of the content module: moderation for trust; the project link, the project
 * updates of the feed and the publications of a project page for projects.
 * At startup it gives media the read rule of the private files of publications.
 */
@Injectable()
export class ContentFacade implements OnModuleInit {
  constructor(
    private readonly content: ContentRepository,
    private readonly presenter: PostPresenter,
    private readonly media: MediaFacade,
    private readonly projects: ProjectLinkRegistry,
    private readonly feedSources: FeedSourcesRegistry,
    private readonly highlights: PostHighlightsService,
  ) {}

  /** Editorial highlight, through the administration (moderators and administrators). */
  setPostFeatured(postId: string, actorId: string, featured: boolean): Promise<void> {
    return this.highlights.setFeatured(postId, actorId, featured);
  }

  featuredPosts(limit: number): Promise<{ id: string; featuredAt: Date | null }[]> {
    return this.highlights.featured(limit);
  }

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

  /**
   * Publications as a reader sees them, by id; the deleted ones and those the reader may not
   * see are absent (a publication shared in a message, §10.3).
   */
  async visiblePosts(viewerId: string, postIds: readonly string[]): Promise<Map<string, Post>> {
    if (postIds.length === 0) return new Map();
    const reader = await this.presenter.reader(viewerId);
    const posts = await this.presenter.present(reader, await this.content.findPosts(postIds));
    return new Map(posts.map((post) => [post.id, post]));
  }

  /** Author of a live publication, null when unknown or deleted. */
  async postAuthorId(postId: string): Promise<string | null> {
    const post = await this.content.findPost(postId);
    return post && !post.deletedAt ? post.authorId : null;
  }

  /** Author of a live comment, null when unknown or deleted (reports, trust module). */
  async commentAuthorId(commentId: string): Promise<string | null> {
    const comment = await this.content.findComment(commentId);
    return comment && !comment.deletedAt ? comment.authorId : null;
  }

  /** Publication of a live comment, null when unknown or deleted (reactions to a comment). */
  async commentPostId(commentId: string): Promise<string | null> {
    const comment = await this.content.findComment(commentId);
    return comment && !comment.deletedAt ? comment.postId : null;
  }

  /** Called at startup by the projects module. */
  registerProjectLinkValidator(validator: ProjectLinkValidator): void {
    this.projects.register(validator);
  }

  /** Called at startup by the projects module: `project_update` items of the feed. */
  registerProjectUpdatesFeedSource(source: ProjectUpdatesFeedSource): void {
    this.projects.registerUpdatesSource(source);
  }

  /** Called at startup by the events module: `event` items of the feed. */
  registerEventsFeedSource(source: EventsFeedSource): void {
    this.feedSources.registerEvents(source);
  }

  /** Called at startup by the discovery module: `suggestion` items closing a small feed. */
  registerFeedSuggestionSource(source: FeedSuggestionSource): void {
    this.feedSources.registerSuggestions(source);
  }

  /**
   * Publications attached to a project, newest first, as the reader may see them (anonymous
   * reader: public publications only).
   */
  async projectPosts(
    projectId: string,
    viewerId: string | null,
    query: CursorPageQuery,
  ): Promise<CursorPage<Post>> {
    const rows = await this.content.projectPosts(
      projectId,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const reader = viewerId ? await this.presenter.reader(viewerId) : ANONYMOUS_READER;
    const records = await this.content.findPosts(page.map((row) => row.id));
    const ordered = page.flatMap((row) => records.filter((record) => record.id === row.id));
    const last = page.at(-1);
    return {
      items: await this.presenter.present(reader, ordered),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.createdAt, key: last.id })
          : null,
    };
  }
}

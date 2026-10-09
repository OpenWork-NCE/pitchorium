import { Injectable, Logger } from '@nestjs/common';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { MediaFacade } from '../../media';
import { ProfilesFacade } from '../../profiles';
import { PostUpdated } from '../domain/content-events';
import type { LinkPreviewState } from '../domain/post';
import { parseOpenGraph } from '../domain/open-graph';
import { dayOf } from '../domain/views';
import { ContentEventsRecorder } from './content-events.recorder';
import {
  ContentRepository,
  LinkPageFetcher,
  LinkPreviewRefusedError,
  PostViewCounter,
} from './ports';
import { postResource } from './posts.service';

const DAY_MS = 86_400_000;

/** Work of the content module in the worker: link previews, statistics, consistency. */
@Injectable()
export class ContentMaintenanceService {
  private readonly logger = new Logger(ContentMaintenanceService.name);

  constructor(
    private readonly content: ContentRepository,
    private readonly pages: LinkPageFetcher,
    private readonly views: PostViewCounter,
    private readonly media: MediaFacade,
    private readonly profiles: ProfilesFacade,
    private readonly events: ContentEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  /**
   * Fetches the linked page (outside any transaction, ADR 0019), reads its Open Graph tags and
   * asks the media module to import its image (ADR 0033). A refused or failed fetch gives a
   * `failed` preview: the link stays shown without preview.
   */
  async buildLinkPreview(postId: string): Promise<void> {
    const post = await this.content.findPost(postId);
    if (!post?.linkUrl || post.deletedAt || post.linkPreview?.status !== 'pending') return;
    await this.content.setPreview(postId, await this.preview(post.linkUrl, post.authorId));
  }

  /** The preview the composer asked for before publishing (ADR 0118), built the same way. */
  async buildDraftLinkPreview(previewId: string): Promise<void> {
    const draft = await this.content.findLinkPreview(previewId);
    if (draft?.status !== 'pending') return;
    await this.content.setLinkPreview(previewId, await this.preview(draft.url, draft.ownerId));
  }

  /** Previews asked more than a day ago and never published (their image is an orphan). */
  async purgeLinkPreviews(): Promise<number> {
    return this.content.purgeLinkPreviews(new Date(this.clock.now().getTime() - DAY_MS));
  }

  private async preview(url: string, ownerId: string): Promise<LinkPreviewState> {
    let preview: ReturnType<typeof parseOpenGraph>;
    try {
      const page = await this.pages.fetchHtml(url);
      preview = parseOpenGraph(page.html, page.finalUrl);
    } catch (error) {
      if (!(error instanceof LinkPreviewRefusedError)) throw error;
      this.logger.warn(`Link preview refused: ${error.message}`);
      return {
        status: 'failed',
        title: null,
        description: null,
        siteName: null,
        imageMediaId: null,
      };
    }
    const imageMediaId = preview.imageUrl
      ? await this.media.requestImport({ ownerId, usage: 'link_preview', url: preview.imageUrl })
      : null;
    return {
      status: 'ready',
      title: preview.title,
      description: preview.description,
      siteName: preview.siteName,
      imageMediaId,
    };
  }

  /** The imported preview image is ready: it is attached to its publication. */
  async attachPreviewImage(mediaId: string): Promise<void> {
    for (const post of await this.content.postsWithPreviewImage(mediaId)) {
      if (post.deletedAt) continue;
      await this.media.attach({
        mediaId,
        ownerId: post.authorId,
        usage: 'link_preview',
        resource: postResource(post.id),
        resourceVisibility: post.visibility === 'public' ? 'public' : 'private',
      });
    }
  }

  /** The import failed: the preview stays, without image. */
  async dropPreviewImage(mediaId: string): Promise<void> {
    for (const post of await this.content.postsWithPreviewImage(mediaId)) {
      if (post.linkPreview) {
        await this.content.setPreview(post.id, { ...post.linkPreview, imageMediaId: null });
      }
    }
    for (const draft of await this.content.linkPreviewsWithImage(mediaId)) {
      await this.content.setLinkPreview(draft.id, { ...draft, imageMediaId: null });
    }
  }

  /**
   * A member disabled their public page: their public publications become members-only and
   * their files move to the private bucket (ADR 0031). Re-enabling the page restores nothing.
   */
  async withdrawPublicPosts(userId: string): Promise<number> {
    if ((await this.profiles.visibilityOf(userId))?.publicPageEnabled !== false) return 0;
    const ids = await this.content.publicPostIdsOfMember(userId);
    for (const postId of ids) {
      await this.transactions.run(async () => {
        await this.content.updatePost(postId, { visibility: 'members' });
        await this.media.setResourceVisibility(postResource(postId), 'private');
        await this.events.record(PostUpdated, postId, { authorId: userId, fields: ['visibility'] });
      });
    }
    return ids.length;
  }

  /** Writes the unique viewers of today and yesterday from the HyperLogLogs (ADR 0034). */
  async consolidateViews(): Promise<number> {
    const now = this.clock.now();
    let written = 0;
    for (const day of [dayOf(now), dayOf(new Date(now.getTime() - DAY_MS))]) {
      const postIds = await this.views.postIdsSeen(day);
      for (let start = 0; start < postIds.length; start += 500) {
        const batch = postIds.slice(start, start + 500);
        const existing = new Set((await this.content.findPosts(batch)).map((post) => post.id));
        const counts = await this.views.count(day, batch);
        const rows = batch
          .filter((postId) => existing.has(postId))
          .map((postId) => ({ postId, day, uniqueViewers: counts.get(postId) ?? 0 }));
        await this.content.upsertDailyViews(rows, now);
        written += rows.length;
      }
    }
    return written;
  }
}

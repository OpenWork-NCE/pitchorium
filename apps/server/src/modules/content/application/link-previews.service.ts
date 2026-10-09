import { Injectable } from '@nestjs/common';
import type { LinkPreviewDraft } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { MediaFacade } from '../../media';
import { LinkPreviewRequested } from '../domain/content-events';
import type { LinkPreviewDraftRecord } from '../domain/post';
import { ContentEventsRecorder } from './content-events.recorder';
import { ContentRepository } from './ports';

const notFound = () => new DomainError('CONTENT_LINK_PREVIEW_NOT_FOUND', 'Link preview not found');

/**
 * Previews of links asked by the composer before publishing (ADR 0118): the worker fetches the
 * page through the SSRF-protected client and imports its image, as for a publication; the
 * author reads it until it is ready, then the publication reuses it.
 */
@Injectable()
export class LinkPreviewsService {
  constructor(
    private readonly content: ContentRepository,
    private readonly media: MediaFacade,
    private readonly events: ContentEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async request(userId: string, url: string): Promise<LinkPreviewDraft> {
    const draft: LinkPreviewDraftRecord = {
      id: this.ids.next(),
      ownerId: userId,
      url,
      status: 'pending',
      title: null,
      description: null,
      siteName: null,
      imageMediaId: null,
      createdAt: this.clock.now(),
    };
    await this.transactions.run(async () => {
      await this.content.insertLinkPreview(draft);
      await this.events.record(LinkPreviewRequested, draft.id, { ownerId: userId });
    });
    return this.present(draft);
  }

  /** A preview of its owner only; anyone else gets 404, as for an unknown one. */
  async get(userId: string, id: string): Promise<LinkPreviewDraft> {
    const draft = await this.content.findLinkPreview(id);
    if (!draft || draft.ownerId !== userId) throw notFound();
    return this.present(draft);
  }

  private async present(draft: LinkPreviewDraftRecord): Promise<LinkPreviewDraft> {
    const image = draft.imageMediaId
      ? (await this.media.images([draft.imageMediaId])).get(draft.imageMediaId)
      : undefined;
    return {
      id: draft.id,
      url: draft.url,
      status: draft.status,
      title: draft.title,
      description: draft.description,
      siteName: draft.siteName,
      imageUrl: image?.url ?? null,
    };
  }
}

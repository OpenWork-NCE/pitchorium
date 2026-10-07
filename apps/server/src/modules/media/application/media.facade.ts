import { Injectable } from '@nestjs/common';
import type { MediaModerationStatus, MediaUsage, MediaVariant } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { ObjectStorage } from '../../../platform/storage';
import {
  assertAttachable,
  isServable,
  type MediaAssetRecord,
  type MediaResourceRef,
  storageKeys,
} from '../domain/media-asset';
import { MediaRequested } from '../domain/media-events';
import { USAGE_RULES } from '../domain/usages';
import { MediaEventsRecorder } from './media-events.recorder';
import { MediaReadRegistry } from './media-read.registry';
import { variantsOf } from './media-views';
import { type MediaReadAuthorizer, MediaRepository } from './ports';

export interface AttachRequest {
  mediaId: string;
  /** The member who uploaded the file: only their own files can be attached. */
  ownerId: string;
  usage: MediaUsage;
  resource: MediaResourceRef;
}

/** A public, ready image as other modules display it. */
export interface MediaImage {
  mediaId: string;
  /** Largest WebP variant. */
  url: string;
  variants: Record<string, MediaVariant>;
}

export interface MediaSummary {
  id: string;
  ownerId: string;
  usage: MediaUsage;
  status: MediaAssetRecord['status'];
  attachedTo: MediaResourceRef | null;
}

/**
 * Public facade of the media module. Other modules hold asset ids only and go through these
 * methods; writes join the caller's transaction.
 */
@Injectable()
export class MediaFacade {
  constructor(
    private readonly assets: MediaRepository,
    private readonly storage: ObjectStorage,
    private readonly readers: MediaReadRegistry,
    private readonly events: MediaEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** Attaches a ready asset of the owner to a resource, within the usage limit per resource. */
  attach(request: AttachRequest): Promise<void> {
    return this.transactions.run(async () => {
      const asset = assertAttachable(
        await this.assets.findById(request.mediaId),
        request.ownerId,
        request.usage,
      );
      const { type, id } = request.resource;
      if (asset.attachedTo?.type === type && asset.attachedTo.id === id) return;
      if (asset.attachedTo) {
        throw new DomainError('MEDIA_ATTACHED', 'Media is attached to another resource');
      }
      await this.assets.lock(`media:resource:${type}:${id}`);
      const attached = await this.assets.countAttached(request.resource, request.usage, asset.id);
      if (attached >= USAGE_RULES[request.usage].maxPerResource) {
        throw new DomainError('MEDIA_LIMIT_REACHED', `Too many ${request.usage} files on ${type}`);
      }
      const now = this.clock.now();
      const updated = await this.assets.update(
        asset.id,
        { attachedTo: request.resource, attachedAt: now, unattachedSince: null },
        now,
        ['ready'],
      );
      if (!updated) throw new DomainError('MEDIA_NOT_READY', 'Media is not ready');
    });
  }

  /** Detaches an asset; the orphan cleanup deletes it after MEDIA_ORPHAN_TTL_HOURS. */
  async detach(mediaId: string): Promise<void> {
    const now = this.clock.now();
    await this.assets.update(
      mediaId,
      { attachedTo: null, attachedAt: null, unattachedSince: now },
      now,
      ['ready'],
    );
  }

  async describe(mediaId: string): Promise<MediaSummary | null> {
    const asset = await this.assets.findById(mediaId);
    return asset && asset.status !== 'deleted'
      ? {
          id: asset.id,
          ownerId: asset.ownerId,
          usage: asset.usage,
          status: asset.status,
          attachedTo: asset.attachedTo,
        }
      : null;
  }

  /** Public images that can be displayed, by asset id; other ids are absent from the map. */
  async images(mediaIds: readonly (string | null)[]): Promise<Map<string, MediaImage>> {
    const ids = [...new Set(mediaIds.filter((id): id is string => id !== null))];
    if (ids.length === 0) return new Map();
    const images = new Map<string, MediaImage>();
    for (const asset of await this.assets.findByIds(ids)) {
      if (asset.visibility !== 'public' || !isServable(asset)) continue;
      const variants = variantsOf(asset, this.storage);
      const largest = Object.values(variants).sort((a, b) => b.width - a.width)[0];
      if (largest?.webp) images.set(asset.id, { mediaId: asset.id, url: largest.webp, variants });
    }
    return images;
  }

  /** Moderation (trust module): a removed file is no longer served. */
  async setModerationStatus(mediaId: string, status: MediaModerationStatus): Promise<void> {
    const updated = await this.assets.update(
      mediaId,
      { moderationStatus: status },
      this.clock.now(),
    );
    if (!updated) throw new DomainError('MEDIA_NOT_FOUND', 'Media not found');
  }

  /**
   * Imports an image from a provider URL (OAuth photo) through the processing pipeline. The
   * worker downloads it from a closed list of hosts; `media.asset.ready.v1` reports the result.
   */
  requestImport(request: { ownerId: string; usage: MediaUsage; url: string }): Promise<string> {
    const rule = USAGE_RULES[request.usage];
    const [contentType] = rule.contentTypes;
    if (!rule.image || !contentType) {
      throw new DomainError('MEDIA_TYPE_NOT_ALLOWED', `${request.usage} accepts no image`);
    }
    return this.transactions.run(async () => {
      const id = this.ids.next();
      const now = this.clock.now();
      await this.assets.insert({
        id,
        ownerId: request.ownerId,
        usage: request.usage,
        source: 'import',
        status: 'pending',
        visibility: rule.visibility,
        declaredContentType: contentType,
        declaredSize: 0,
        contentType: null,
        size: null,
        sha256: null,
        width: null,
        height: null,
        pageCount: null,
        quarantineKey: storageKeys.quarantine(id),
        files: null,
        rejectionReason: null,
        moderationStatus: 'none',
        importUrl: request.url,
        attachedTo: null,
        unattachedSince: now,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      await this.events.record(MediaRequested, id, {
        usage: request.usage,
        source: 'import',
        ownerId: request.ownerId,
      });
      return id;
    });
  }

  registerReadAuthorizer(authorizer: MediaReadAuthorizer): void {
    this.readers.register(authorizer);
  }
}

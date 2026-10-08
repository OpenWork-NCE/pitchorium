import { Injectable } from '@nestjs/common';
import type {
  MediaModerationStatus,
  MediaUsage,
  MediaVariant,
  MediaVisibility,
} from '@pitchorium/contracts';
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
import { MediaRequested, MediaVisibilityRequested } from '../domain/media-events';
import { initialVisibility, USAGE_RULES, visibilityFor } from '../domain/usages';
import { MediaEventsRecorder } from './media-events.recorder';
import { MediaRetentionRegistry } from './media-retention.registry';
import { MediaReadRegistry } from './media-read.registry';
import { signedVariantsOf, variantsOf } from './media-views';
import { type MediaReadAuthorizer, MediaRepository } from './ports';

export interface AttachRequest {
  mediaId: string;
  /** The member who uploaded the file: only their own files can be attached. */
  ownerId: string;
  usage: MediaUsage;
  resource: MediaResourceRef;
  /**
   * Visibility of the resource, for a usage that follows it (ADR 0026): its files are public
   * only for a public resource. Private by default.
   */
  resourceVisibility?: MediaVisibility;
}

/**
 * A ready image as other modules display it: public URLs for a public file, short-lived
 * presigned URLs for a private one (the caller shows it only to viewers it authorized).
 */
export interface MediaImage {
  mediaId: string;
  /** Largest WebP variant. */
  url: string;
  variants: Record<string, MediaVariant>;
}

/** Lifetime of the presigned URLs of private images; they are stable for half of it. */
export const PRIVATE_IMAGE_URL_TTL_SECONDS = 600;

export interface MediaSummary {
  id: string;
  ownerId: string;
  usage: MediaUsage;
  status: MediaAssetRecord['status'];
  attachedTo: MediaResourceRef | null;
  /** Pages of a ready PDF, null otherwise. */
  pageCount: number | null;
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
    private readonly retention: MediaRetentionRegistry,
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
      await this.requestVisibility(asset, request.resourceVisibility ?? 'private');
    });
  }

  /**
   * The resource changed visibility: the files of its usages that follow it move to the
   * matching bucket, asynchronously (worker). Joins the caller's transaction.
   */
  setResourceVisibility(resource: MediaResourceRef, visibility: MediaVisibility): Promise<void> {
    return this.transactions.run(async () => {
      for (const asset of await this.assets.attachedTo(resource)) {
        await this.requestVisibility(asset, visibility);
      }
    });
  }

  /** Records the bucket the files belong in and asks the worker to move them when needed. */
  private async requestVisibility(
    asset: MediaAssetRecord,
    resource: MediaVisibility,
  ): Promise<void> {
    const rule = USAGE_RULES[asset.usage];
    if (rule.visibility !== 'resource' || asset.status !== 'ready') return;
    const target = visibilityFor(rule, resource);
    const current = asset.targetVisibility ?? asset.visibility;
    if (target === current) return;
    const now = this.clock.now();
    await this.assets.update(
      asset.id,
      { targetVisibility: target === asset.visibility ? null : target },
      now,
    );
    if (target !== asset.visibility) {
      await this.events.record(MediaVisibilityRequested, asset.id, { visibility: target });
    }
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
          pageCount: asset.pageCount,
        }
      : null;
  }

  /**
   * Images that can be displayed, by asset id (variants of an image, thumbnail of a PDF);
   * other ids are absent from the map. A private file gets presigned URLs, signed at the start
   * of a window of half their lifetime so that browsers can cache them: callers only ask for
   * the images of resources the viewer may see.
   */
  async images(mediaIds: readonly (string | null)[]): Promise<Map<string, MediaImage>> {
    const ids = [...new Set(mediaIds.filter((id): id is string => id !== null))];
    if (ids.length === 0) return new Map();
    const window = (PRIVATE_IMAGE_URL_TTL_SECONDS / 2) * 1000;
    const signedAt = new Date(Math.floor(this.clock.now().getTime() / window) * window);
    const images = new Map<string, MediaImage>();
    for (const asset of await this.assets.findByIds(ids)) {
      if (!isServable(asset)) continue;
      const variants =
        asset.visibility === 'public'
          ? variantsOf(asset, this.storage)
          : await signedVariantsOf(asset, this.storage, {
              signedAt,
              expiresInSeconds: PRIVATE_IMAGE_URL_TTL_SECONDS,
            });
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
        visibility: initialVisibility(rule),
        targetVisibility: null,
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

  /**
   * Called at startup by a module whose files the law keeps after the erasure of their owner
   * (payments: KYC documents, proofs of off-platform contributions).
   */
  retainOnErasure(resourceTypes: readonly string[]): void {
    this.retention.register(resourceTypes);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateUploadRequest,
  MediaAsset,
  MediaDownload,
  UploadTicket,
} from '@pitchorium/contracts';
import { API_CONFIG, type ApiConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { ObjectStorage } from '../../../platform/storage';
import {
  assertConfirmable,
  assertDeclaredUpload,
  assertDeletable,
  assertWithinQuota,
  isServable,
  type MediaAssetRecord,
  storageKeys,
} from '../domain/media-asset';
import { MediaDeleted, MediaRequested, MediaUploaded } from '../domain/media-events';
import { MediaEventsRecorder } from './media-events.recorder';
import { MediaReadRegistry } from './media-read.registry';
import { mediaAssetView } from './media-views';
import { MediaRepository, UploadRateLimiter } from './ports';

const notFound = () => new DomainError('MEDIA_NOT_FOUND', 'Media not found');

/** Upload lifecycle on the api side: request, confirmation, reading and deletion. */
@Injectable()
export class MediaUploadsService {
  constructor(
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    private readonly assets: MediaRepository,
    private readonly storage: ObjectStorage,
    private readonly rateLimiter: UploadRateLimiter,
    private readonly readers: MediaReadRegistry,
    private readonly events: MediaEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /**
   * Records a pending asset and returns a presigned URL to the private quarantine prefix, with
   * the declared type and exact size signed in.
   */
  async requestUpload(ownerId: string, request: CreateUploadRequest): Promise<UploadTicket> {
    const rule = assertDeclaredUpload(request.usage, request.contentType, request.size);
    if (!(await this.rateLimiter.consume(ownerId))) {
      throw new DomainError('RATE_LIMITED', 'Too many upload requests');
    }
    const id = this.ids.next();
    const asset = await this.transactions.run(async () => {
      await this.assets.lock(`media:owner:${ownerId}`);
      assertWithinQuota(await this.assets.usageOf(ownerId), request.size, this.config.media.quota);
      const now = this.clock.now();
      const record: MediaAssetRecord = {
        id,
        ownerId,
        usage: request.usage,
        source: 'upload',
        status: 'pending',
        visibility: rule.visibility,
        declaredContentType: request.contentType,
        declaredSize: request.size,
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
        importUrl: null,
        attachedTo: null,
        unattachedSince: now,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await this.assets.insert(record);
      await this.events.record(MediaRequested, id, {
        usage: request.usage,
        source: 'upload',
        ownerId,
      });
      return record;
    });
    const upload = await this.storage.createUploadUrl({
      visibility: 'private',
      key: asset.quarantineKey,
      contentType: request.contentType,
      contentLength: request.size,
      expiresInSeconds: this.config.media.uploadUrlTtlSeconds,
    });
    return {
      media: mediaAssetView(asset, this.storage),
      upload: {
        method: 'PUT',
        url: upload.url,
        headers: upload.headers,
        expiresAt: upload.expiresAt.toISOString(),
      },
    };
  }

  /** The client has uploaded the file: processing is queued through the outbox. Idempotent. */
  async confirm(ownerId: string, mediaId: string): Promise<MediaAsset> {
    const asset = await this.owned(ownerId, mediaId);
    // A repeated confirmation (client retry) answers the current state.
    if (asset.status !== 'pending') return mediaAssetView(asset, this.storage);
    assertConfirmable(asset);
    // Outside any transaction: a storage call (ADR 0019).
    if (!(await this.storage.headObject('private', asset.quarantineKey))) {
      throw new DomainError('MEDIA_UPLOAD_MISSING', 'The file has not been uploaded');
    }
    await this.transactions.run(async () => {
      const moved = await this.assets.update(mediaId, { status: 'processing' }, this.clock.now(), [
        'pending',
      ]);
      if (!moved) throw new DomainError('MEDIA_INVALID_STATE', 'Media is no longer pending');
      await this.events.record(MediaUploaded, mediaId, { usage: asset.usage });
    });
    return mediaAssetView(await this.owned(ownerId, mediaId), this.storage);
  }

  async get(ownerId: string, mediaId: string): Promise<MediaAsset> {
    return mediaAssetView(await this.owned(ownerId, mediaId), this.storage);
  }

  /** Logical deletion; the worker purges the files. */
  async delete(ownerId: string, mediaId: string): Promise<void> {
    const asset = await this.owned(ownerId, mediaId);
    assertDeletable(asset);
    await this.transactions.run(async () => {
      const now = this.clock.now();
      const deleted = await this.assets.update(
        mediaId,
        { status: 'deleted', deletedAt: now },
        now,
        ['pending', 'processing', 'ready', 'rejected'],
      );
      if (!deleted) throw notFound();
      await this.events.record(MediaDeleted, mediaId, {
        usage: asset.usage,
        ownerId,
        reason: 'owner_request',
      });
    });
  }

  /**
   * URL to read a file: the public URL of a public file, a short-lived presigned URL of a
   * private one for its owner or for a member the owning module allows (MediaReadRegistry).
   * Anything else answers 404, so that private files cannot be probed.
   */
  async download(viewerId: string, mediaId: string, variant?: string): Promise<MediaDownload> {
    const asset = await this.assets.findById(mediaId);
    if (!asset || !isServable(asset)) throw notFound();
    const key = this.objectKey(asset, variant);
    if (asset.visibility === 'public') return { url: this.storage.publicUrl(key), expiresAt: null };
    const allowed =
      asset.ownerId === viewerId ||
      (asset.attachedTo !== null && (await this.readers.canRead(viewerId, asset.attachedTo)));
    if (!allowed) throw notFound();
    const signed = await this.storage.createDownloadUrl({
      visibility: 'private',
      key,
      expiresInSeconds: this.config.media.downloadUrlTtlSeconds,
    });
    return { url: signed.url, expiresAt: signed.expiresAt.toISOString() };
  }

  /** The PDF itself by default, otherwise the named (or largest) variant in WebP. */
  private objectKey(asset: MediaAssetRecord, variant: string | undefined): string {
    const files = asset.files;
    if (!variant && files?.fileKey) return files.fileKey;
    const variants = Object.entries(files?.variants ?? {});
    const chosen = variant
      ? variants.find(([name]) => name === variant)
      : variants.sort(([, a], [, b]) => b.width - a.width)[0];
    if (!chosen) throw notFound();
    return chosen[1].webpKey;
  }

  private async owned(ownerId: string, mediaId: string): Promise<MediaAssetRecord> {
    const asset = await this.assets.findById(mediaId);
    if (!asset || asset.ownerId !== ownerId || asset.status === 'deleted') throw notFound();
    return asset;
  }
}

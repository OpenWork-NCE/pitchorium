import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { MediaUsage } from '@pitchorium/contracts';
import { and, eq, inArray, isNull } from '@pitchorium/db/orm';
import { mediaAssets } from '@pitchorium/db/schemas/media';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { ERASURE_ORDER, type ExportedFile, PrivacyFacade } from '../../privacy';
import { MediaEventsRecorder } from '../application/media-events.recorder';
import { MediaRetentionRegistry } from '../application/media-retention.registry';
import { MediaDeleted } from '../domain/media-events';
import type { MediaFiles } from '../domain/media-asset';

const LIVE = ['pending', 'processing', 'ready', 'rejected'];

/** The largest variant of an image, or the file itself (PDF). */
function exportedKey(files: MediaFiles | null): string | null {
  if (!files) return null;
  if (files.fileKey) return files.fileKey;
  const variants = Object.values(files.variants).sort((a, b) => b.width - a.width);
  return variants[0]?.webpKey ?? null;
}

/**
 * Personal data of media: the files of the member. The erasure deletes them (the stored
 * objects are removed and purged from the CDN by the purge task, every 5 minutes), except the
 * files the law keeps (MediaRetentionRegistry), kept under the pseudonym.
 */
@Injectable()
export class MediaPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly retention: MediaRetentionRegistry,
    private readonly events: MediaEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'media',
      description:
        'The files you uploaded (photos, images, documents) with their usage and state; the files themselves are in files/.',
      order: ERASURE_ORDER.files,
      exporter: {
        export: async (userId) => {
          const assets = await this.db
            .select()
            .from(mediaAssets)
            .where(and(eq(mediaAssets.ownerId, userId), isNull(mediaAssets.deletedAt)));
          const files: ExportedFile[] = [];
          for (const asset of assets) {
            const key = asset.status === 'ready' ? exportedKey(asset.files) : null;
            if (!key) continue;
            const extension = key.split('.').pop() ?? 'bin';
            files.push({
              name: `${asset.id}.${extension}`,
              visibility: asset.visibility === 'public' ? 'public' : 'private',
              key,
            });
          }
          return {
            data: {
              files: assets.map((asset) => ({
                id: asset.id,
                usage: asset.usage,
                status: asset.status,
                contentType: asset.contentType,
                size: asset.size,
                attachedTo: asset.attachedResourceType,
                createdAt: asset.createdAt,
              })),
            },
            files,
          };
        },
      },
      eraser: {
        erase: async ({ userId, pseudonym }) => {
          const now = this.clock.now();
          const owned = await this.db
            .select()
            .from(mediaAssets)
            .where(and(eq(mediaAssets.ownerId, userId), inArray(mediaAssets.status, LIVE)));
          const erased = owned.filter(
            (asset) => !this.retention.retains(asset.attachedResourceType),
          );
          if (erased.length > 0) {
            await this.db
              .update(mediaAssets)
              .set({ status: 'deleted', deletedAt: now, updatedAt: now })
              .where(
                inArray(
                  mediaAssets.id,
                  erased.map((asset) => asset.id),
                ),
              );
          }
          for (const asset of erased) {
            await this.events.record(MediaDeleted, asset.id, {
              usage: asset.usage as MediaUsage,
              ownerId: pseudonym,
              reason: 'erasure',
            });
          }
          await replaceIdentifier(
            this.db,
            [
              { table: 'media.assets', column: 'owner_id' },
              { table: 'media.assets', column: 'attached_resource_id', kind: 'text' },
            ],
            userId,
            pseudonym,
          );
        },
      },
    });
  }
}

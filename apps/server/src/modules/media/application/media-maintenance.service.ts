import { Inject, Injectable, Logger } from '@nestjs/common';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { ObjectStorage } from '../../../platform/storage';
import { fileKeys } from '../domain/media-asset';
import { MediaDeleted } from '../domain/media-events';
import { MediaEventsRecorder } from './media-events.recorder';
import { MediaRepository } from './ports';

const BATCH_SIZE = 200;

/** Scheduled tasks of the media module (worker). */
@Injectable()
export class MediaMaintenanceService {
  private readonly logger = new Logger(MediaMaintenanceService.name);

  constructor(
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
    private readonly assets: MediaRepository,
    private readonly storage: ObjectStorage,
    private readonly events: MediaEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  /**
   * Logically deletes the assets left without attachment for MEDIA_ORPHAN_TTL_HOURS: uploads
   * never confirmed or never attached, rejections, detached files.
   */
  async deleteOrphans(): Promise<number> {
    const now = this.clock.now();
    const cutoff = new Date(now.getTime() - this.config.media.orphanTtlMs);
    let deleted = 0;
    for (const id of await this.assets.orphanIds(cutoff, BATCH_SIZE)) {
      await this.transactions.run(async () => {
        const asset = await this.assets.findById(id);
        if (!asset || asset.attachedTo || asset.status === 'deleted') return;
        const done = await this.assets.update(id, { status: 'deleted', deletedAt: now }, now, [
          'pending',
          'processing',
          'ready',
          'rejected',
        ]);
        if (!done) return;
        await this.events.record(MediaDeleted, id, {
          usage: asset.usage,
          ownerId: asset.ownerId,
          reason: 'orphan_cleanup',
        });
        deleted += 1;
      });
    }
    if (deleted > 0) this.logger.log(`Deleted ${deleted} orphan media`);
    return deleted;
  }

  /**
   * Removes the stored objects of deleted assets, outside any transaction. Both buckets are
   * cleared: a move between buckets may have been interrupted (ADR 0026).
   */
  async purgeDeleted(): Promise<number> {
    const pending = await this.assets.unpurged(BATCH_SIZE);
    for (const asset of pending) {
      if (asset.files) {
        const keys = fileKeys(asset.files);
        await this.storage.deleteObjects('public', keys);
        await this.storage.deleteObjects('private', keys);
      }
      await this.storage.deleteObjects('private', [asset.quarantineKey]);
      await this.assets.markPurged(asset.id, this.clock.now());
    }
    return pending.length;
  }
}

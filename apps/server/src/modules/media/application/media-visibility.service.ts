import { Injectable, Logger } from '@nestjs/common';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { ObjectStorage } from '../../../platform/storage';
import { contentTypeOfKey, fileKeys, hasPendingMove } from '../domain/media-asset';
import { cacheControlFor, ruleOf } from '../domain/usages';
import { MediaRepository } from './ports';

/**
 * Moves the files of an asset to the bucket of its target visibility (worker, idempotent,
 * ADR 0026): server-side copies outside any transaction (ADR 0019), a short transaction that
 * switches the bucket only if the target did not change meanwhile, then deletion of the source.
 * Until the switch, the files are served from the source bucket.
 */
@Injectable()
export class MediaVisibilityService {
  private readonly logger = new Logger(MediaVisibilityService.name);

  constructor(
    private readonly assets: MediaRepository,
    private readonly storage: ObjectStorage,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  async move(mediaId: string): Promise<void> {
    const asset = await this.assets.findById(mediaId);
    if (!asset || !asset.files || !hasPendingMove(asset) || !asset.targetVisibility) return;
    const from = asset.visibility;
    const to = asset.targetVisibility;
    const keys = fileKeys(asset.files);
    const cacheControl = cacheControlFor(ruleOf(asset.usage), to);
    for (const key of keys) {
      await this.storage.copyObject({
        from,
        to,
        key,
        contentType: contentTypeOfKey(key),
        cacheControl,
      });
    }
    const switched = await this.transactions.run(async () => {
      const current = await this.assets.findById(mediaId);
      if (!current || current.visibility !== from || current.targetVisibility !== to) return false;
      return this.assets.update(
        mediaId,
        { visibility: to, targetVisibility: null },
        this.clock.now(),
        ['ready'],
      );
    });
    // The source goes once the switch is written; copies of a cancelled move are removed.
    await this.storage.deleteObjects(switched ? from : to, keys);
    if (switched) this.logger.log(`Media ${mediaId} moved from ${from} to ${to}`);
  }
}

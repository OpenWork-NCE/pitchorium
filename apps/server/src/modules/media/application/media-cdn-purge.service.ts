import { Injectable, Logger } from '@nestjs/common';
import { CdnCache, ObjectStorage } from '../../../platform/storage';
import { MediaRepository } from './ports';

/**
 * Purges from the CDN the public URLs of files that left the public bucket (worker job,
 * idempotent, retried on failure; ADR 0026). The public copies are deleted first, so that the
 * CDN cannot fetch them again after the purge, unless the asset was made public again
 * meanwhile: its files are then back under the same keys.
 */
@Injectable()
export class MediaCdnPurgeService {
  private readonly logger = new Logger(MediaCdnPurgeService.name);

  constructor(
    private readonly assets: MediaRepository,
    private readonly storage: ObjectStorage,
    private readonly cdn: CdnCache,
  ) {}

  async purge(mediaId: string, keys: readonly string[]): Promise<void> {
    const asset = await this.assets.findById(mediaId);
    const public_ =
      asset !== null &&
      asset.status !== 'deleted' &&
      (asset.visibility === 'public' || asset.targetVisibility === 'public');
    if (!public_) await this.storage.deleteObjects('public', keys);
    await this.cdn.purge(keys.map((key) => this.storage.publicUrl(key)));
    this.logger.log(`Purged ${keys.length} CDN URLs of media ${mediaId}`);
  }
}

import { CdnCache } from '../../../src/platform/storage';

/** Records the purged URLs instead of calling a CDN. */
export class SpyCdnCache extends CdnCache {
  readonly purged: string[] = [];

  purge(urls: readonly string[]): Promise<void> {
    this.purged.push(...urls);
    return Promise.resolve();
  }
}

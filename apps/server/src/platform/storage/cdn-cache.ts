/**
 * Port: invalidation of public URLs in the CDN in front of the public bucket. A purge is
 * idempotent: purging a URL that is not cached does nothing.
 */
export abstract class CdnCache {
  abstract purge(urls: readonly string[]): Promise<void>;
}

/** No CDN in front of the public bucket (local development and tests). */
export class NoopCdnCache extends CdnCache {
  purge(): Promise<void> {
    return Promise.resolve();
  }
}

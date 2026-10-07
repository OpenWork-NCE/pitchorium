import { CdnCache } from './cdn-cache';

const API_BASE_URL = 'https://api.cloudflare.com/client/v4';
/** Single-file purge accepts at most 100 URLs per request on the Free, Pro and Business plans. */
const URLS_PER_REQUEST = 100;
const TIMEOUT_MS = 10_000;

export interface CloudflareCdnConfig {
  zoneId: string;
  /** API token restricted to the zone, with the « Cache Purge » permission only. */
  apiToken: string;
}

interface PurgeResponse {
  success?: boolean;
  errors?: { code: number; message: string }[];
}

/**
 * Purge by URL through the Cloudflare API (`POST /zones/{zone_id}/purge_cache`, `files`). A
 * failure throws, so that the job calling it is retried.
 */
export class CloudflareCdnCache extends CdnCache {
  constructor(
    private readonly config: CloudflareCdnConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
    super();
  }

  async purge(urls: readonly string[]): Promise<void> {
    const unique = [...new Set(urls)];
    for (let start = 0; start < unique.length; start += URLS_PER_REQUEST) {
      await this.purgeBatch(unique.slice(start, start + URLS_PER_REQUEST));
    }
  }

  private async purgeBatch(files: string[]): Promise<void> {
    const response = await this.fetchFn(
      `${API_BASE_URL}/zones/${encodeURIComponent(this.config.zoneId)}/purge_cache`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.apiToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ files }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    const body = (await response.json().catch(() => ({}))) as PurgeResponse;
    if (!response.ok || body.success !== true) {
      const reasons = (body.errors ?? []).map((error) => `${error.code} ${error.message}`);
      throw new Error(
        `Cloudflare cache purge failed (HTTP ${response.status}${reasons.length ? `: ${reasons.join('; ')}` : ''})`,
      );
    }
  }
}

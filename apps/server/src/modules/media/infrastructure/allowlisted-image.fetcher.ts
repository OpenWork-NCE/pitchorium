import { Inject, Injectable } from '@nestjs/common';
import type { MediaUsage } from '@pitchorium/contracts';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { OutboundRequestRefusedError, SafeHttpClient } from '../../../platform/outbound';
import { ImportRefusedError, RemoteImageFetcher } from '../application/ports';

/** Redirects followed for a link preview image (CDNs often redirect once or twice). */
const LINK_PREVIEW_MAX_REDIRECTS = 3;

/**
 * Closed list of hosts serving OAuth profile photos (SSRF protection): Google and LinkedIn.
 * Microsoft photos are not imported (Graph returns them as data URLs, ADR 0014).
 */
export const PROVIDER_PHOTO_HOSTS: ReadonlySet<string> = new Set([
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
  'media.licdn.com',
]);

/** Refuses anything but an https URL on an allowed host, without credentials or custom port. */
export function assertAllowedPhotoUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ImportRefusedError('Malformed URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new ImportRefusedError(`URL not allowed: ${url.protocol}//${url.host}`);
  }
  if (!PROVIDER_PHOTO_HOSTS.has(url.hostname)) {
    throw new ImportRefusedError(`Host not allowed: ${url.hostname}`);
  }
  return url;
}

/**
 * Downloads an image to import. A provider photo: allowed hosts only, no redirect. A link
 * preview image: any public host through the SSRF-protected client (ADR 0033). Both with a
 * timeout and a size limit.
 */
@Injectable()
export class AllowlistedImageFetcher extends RemoteImageFetcher {
  private readonly outbound = new SafeHttpClient();

  constructor(@Inject(WORKER_CONFIG) private readonly config: WorkerConfig) {
    super();
  }

  async fetch(raw: string, maxBytes: number, usage: MediaUsage): Promise<Buffer> {
    if (usage === 'link_preview') return this.fetchFromAnyPublicHost(raw, maxBytes);
    const url = assertAllowedPhotoUrl(raw);
    let response: Response;
    try {
      // A redirect could lead to another host: it is an error, not followed.
      response = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(this.config.media.importTimeoutMs),
        headers: { Accept: 'image/*' },
      });
    } catch (error) {
      throw new ImportRefusedError(
        `Download failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!response.ok) throw new ImportRefusedError(`Provider answered ${response.status}`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > maxBytes) throw new ImportRefusedError(`Photo larger than ${maxBytes} bytes`);
    const reader = (response.body as ReadableStream<Uint8Array> | null)?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (let read = await reader?.read(); read && !read.done; read = await reader?.read()) {
      size += read.value.length;
      if (size > maxBytes) {
        await reader?.cancel();
        throw new ImportRefusedError(`Photo larger than ${maxBytes} bytes`);
      }
      chunks.push(read.value);
    }
    return Buffer.concat(chunks);
  }

  private async fetchFromAnyPublicHost(raw: string, maxBytes: number): Promise<Buffer> {
    try {
      const result = await this.outbound.fetch(raw, {
        timeoutMs: this.config.media.importTimeoutMs,
        maxBytes,
        maxRedirects: LINK_PREVIEW_MAX_REDIRECTS,
        accept: 'image/*',
        acceptContentType: (type) => type.startsWith('image/'),
      });
      return result.body;
    } catch (error) {
      if (error instanceof OutboundRequestRefusedError) throw new ImportRefusedError(error.message);
      throw error;
    }
  }
}

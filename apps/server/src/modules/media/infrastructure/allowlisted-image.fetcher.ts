import { Inject, Injectable } from '@nestjs/common';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { ImportRefusedError, RemoteImageFetcher } from '../application/ports';

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

/** Downloads a provider photo: allowed hosts only, no redirect, timeout and size limit. */
@Injectable()
export class AllowlistedImageFetcher extends RemoteImageFetcher {
  constructor(@Inject(WORKER_CONFIG) private readonly config: WorkerConfig) {
    super();
  }

  async fetch(raw: string, maxBytes: number): Promise<Buffer> {
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
}

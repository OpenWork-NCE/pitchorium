import { Inject, Injectable } from '@nestjs/common';
import { WORKER_CONFIG, type WorkerConfig } from '../../../platform/config';
import { OutboundRequestRefusedError, SafeHttpClient } from '../../../platform/outbound';
import { LinkPageFetcher, LinkPreviewRefusedError } from '../application/ports';

const MAX_REDIRECTS = 3;

/** Fetches the linked page with the SSRF protections of platform/outbound (ADR 0033). */
@Injectable()
export class SafeLinkPageFetcher extends LinkPageFetcher {
  constructor(
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
    private readonly client: SafeHttpClient,
  ) {
    super();
  }

  async fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
    try {
      const result = await this.client.fetch(url, {
        timeoutMs: this.config.content.linkPreview.timeoutMs,
        maxBytes: this.config.content.linkPreview.maxBytes,
        maxRedirects: MAX_REDIRECTS,
        accept: 'text/html,application/xhtml+xml',
        acceptContentType: (type) => type === 'text/html' || type === 'application/xhtml+xml',
      });
      return { html: result.body.toString('utf8'), finalUrl: result.url };
    } catch (error) {
      if (error instanceof OutboundRequestRefusedError) {
        throw new LinkPreviewRefusedError(error.message);
      }
      throw error;
    }
  }
}

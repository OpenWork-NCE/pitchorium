import { lookup as dnsLookup } from 'node:dns/promises';
import { type IncomingMessage, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { isPublicAddress } from './address-policy';

/** A request refused or failed for a reason the caller reports, not retries. */
export class OutboundRequestRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutboundRequestRefusedError';
  }
}

export interface SafeFetchOptions {
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
  /** Accept header sent. */
  accept: string;
  /** Checked on the final answer, before the body is read. */
  acceptContentType: (contentType: string) => boolean;
}

export interface SafeFetchResult {
  /** URL of the final answer, after redirects. */
  url: string;
  contentType: string;
  body: Buffer;
}

export type Resolver = (hostname: string) => Promise<string[]>;

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const DEFAULT_PORTS: Readonly<Record<string, string>> = { 'http:': '80', 'https:': '443' };

/** Default ports only: no probing of other services on a public host. */
const defaultPortOnly = (url: URL) => url.port === '' || url.port === DEFAULT_PORTS[url.protocol];

const systemResolver: Resolver = async (hostname) =>
  (await dnsLookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);

/**
 * Outbound HTTP client protected against SSRF (ADR 0033):
 * - http and https only, default ports only, no credentials in the URL;
 * - the host is resolved once per hop and every address must be public; the connection is
 *   made to the address that was checked (custom lookup), so a second DNS answer (rebinding)
 *   is never used;
 * - redirects are followed by hand, each target checked again, up to `maxRedirects`;
 * - an overall timeout and a maximum size of the body.
 */
export class SafeHttpClient {
  constructor(
    private readonly resolver: Resolver = systemResolver,
    private readonly addressAllowed: (address: string) => boolean = isPublicAddress,
    private readonly portAllowed: (url: URL) => boolean = defaultPortOnly,
  ) {}

  async fetch(rawUrl: string, options: SafeFetchOptions): Promise<SafeFetchResult> {
    const signal = AbortSignal.timeout(options.timeoutMs);
    let url = this.parse(rawUrl);
    for (let hop = 0; ; hop += 1) {
      const address = await this.resolve(url);
      const response = await this.send(url, address, options, signal);
      const location = response.headers.location;
      if (REDIRECTS.has(response.statusCode ?? 0) && location) {
        response.resume();
        if (hop >= options.maxRedirects) {
          throw new OutboundRequestRefusedError(`More than ${options.maxRedirects} redirects`);
        }
        url = this.parse(new URL(location, url).toString());
        continue;
      }
      if ((response.statusCode ?? 0) < 200 || (response.statusCode ?? 0) >= 300) {
        response.resume();
        throw new OutboundRequestRefusedError(`Answered ${response.statusCode ?? 0}`);
      }
      const contentType = (response.headers['content-type'] ?? '').split(';')[0]?.trim() ?? '';
      if (!options.acceptContentType(contentType.toLowerCase())) {
        response.resume();
        throw new OutboundRequestRefusedError(`Content type not accepted: ${contentType}`);
      }
      return { url: url.toString(), contentType, body: await this.read(response, options) };
    }
  }

  private parse(raw: string): URL {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new OutboundRequestRefusedError('Malformed URL');
    }
    if (!(url.protocol in DEFAULT_PORTS)) {
      throw new OutboundRequestRefusedError(`Scheme not allowed: ${url.protocol}`);
    }
    if (url.username || url.password) {
      throw new OutboundRequestRefusedError('Credentials in URL not allowed');
    }
    if (!this.portAllowed(url)) {
      throw new OutboundRequestRefusedError(`Port not allowed: ${url.port}`);
    }
    return url;
  }

  /** One resolution per hop; every address of the answer must be allowed. */
  private async resolve(url: URL): Promise<string> {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    let addresses: string[];
    if (isIP(host)) {
      addresses = [host];
    } else {
      try {
        addresses = await this.resolver(host);
      } catch {
        throw new OutboundRequestRefusedError(`Host not resolved: ${host}`);
      }
    }
    const [first] = addresses;
    if (!first || !addresses.every((address) => this.addressAllowed(address))) {
      throw new OutboundRequestRefusedError(`Address not allowed for ${host}`);
    }
    return first;
  }

  private send(
    url: URL,
    address: string,
    options: SafeFetchOptions,
    signal: AbortSignal,
  ): Promise<IncomingMessage> {
    const family = isIP(address);
    // The socket connects to the checked address, whatever a new DNS query would answer.
    const lookup: LookupFunction = (_hostname, lookupOptions, callback) => {
      if (lookupOptions.all) callback(null, [{ address, family }]);
      else callback(null, address, family);
    };
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
    return new Promise((resolve, reject) => {
      const outgoing = request(
        url,
        {
          method: 'GET',
          lookup,
          signal,
          headers: { Accept: options.accept, 'User-Agent': 'PitchoriumBot/1.0 (+link preview)' },
        },
        resolve,
      );
      outgoing.on('error', (error) =>
        reject(
          new OutboundRequestRefusedError(
            signal.aborted ? 'Timed out' : `Request failed: ${error.message}`,
          ),
        ),
      );
      outgoing.end();
    });
  }

  private async read(response: IncomingMessage, options: SafeFetchOptions): Promise<Buffer> {
    const declared = Number(response.headers['content-length'] ?? 0);
    if (declared > options.maxBytes) {
      response.destroy();
      throw new OutboundRequestRefusedError(`Larger than ${options.maxBytes} bytes`);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of response) {
        size += (chunk as Buffer).length;
        if (size > options.maxBytes) {
          response.destroy();
          throw new OutboundRequestRefusedError(`Larger than ${options.maxBytes} bytes`);
        }
        chunks.push(chunk as Buffer);
      }
    } catch (error) {
      if (error instanceof OutboundRequestRefusedError) throw error;
      throw new OutboundRequestRefusedError('Timed out or interrupted while reading');
    }
    return Buffer.concat(chunks);
  }
}

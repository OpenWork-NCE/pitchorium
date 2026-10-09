import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export type FakeProvider = 'google' | 'linkedin' | 'microsoft';

export interface FakeIdentity {
  /** Stable subject at the provider (sub, or oid for Microsoft). */
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

/** Real provider endpoints called by Better Auth, served locally during the tests. */
export const PROVIDER_ROUTES: Readonly<Record<string, string>> = {
  'https://oauth2.googleapis.com/token': '/google/token',
  'https://www.linkedin.com/oauth/v2/accessToken': '/linkedin/token',
  'https://api.linkedin.com/v2/userinfo': '/linkedin/userinfo',
  'https://login.microsoftonline.com/common/oauth2/v2.0/token': '/microsoft/token',
};

const base64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');

async function readRaw(request: IncomingMessage): Promise<string> {
  let raw = '';
  for await (const chunk of request) raw += String(chunk);
  return raw;
}

/** Answer of the server: JSON, or a redirect of the browser. */
type Reply = { status: number; body?: object; location?: string };

/**
 * Local OIDC/OAuth 2 server standing in for Google, LinkedIn and Microsoft.
 *
 * - In the process of the integration tests, `install()` reroutes the provider URLs that Better
 *   Auth calls (global fetch) to this server, and `issueCode()` replaces the consent of the
 *   browser.
 * - As a service of its own (`test/oauth/server.ts`, reachable from a browser), the consent page
 *   is `GET /<provider>/authorize`: it consents at once for the next identity a test announced
 *   (`POST /__identity`) and sends the browser back to the callback of the api with a code. The
 *   api reroutes its own calls with `test/oauth/reroute.cjs`.
 */
export class FakeOAuthProviders {
  private server: Server | undefined;
  private baseUrl = '';
  private readonly codes = new Map<string, { provider: FakeProvider; identity: FakeIdentity }>();
  private readonly nextIdentities = new Map<FakeProvider, FakeIdentity[]>();
  private readonly accessTokens = new Map<string, FakeIdentity>();
  private readonly keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  private originalFetch: typeof fetch | undefined;
  private pausedTokenRequest: { reached: () => void; released: Promise<void> } | undefined;

  /** Starts the server; in process (default), the provider URLs are rerouted to it. */
  async start({ port = 0, host = '127.0.0.1', inProcess = true } = {}): Promise<void> {
    this.server = createServer((request, response) => {
      void this.reply(request).then(
        ({ status, body, location }) => {
          if (location) {
            response.writeHead(status, { location });
            response.end();
            return;
          }
          response.writeHead(status, { 'content-type': 'application/json' });
          response.end(JSON.stringify(body ?? {}));
        },
        () => response.writeHead(500).end(),
      );
    });
    await new Promise<void>((resolve) => this.server?.listen(port, host, resolve));
    this.baseUrl = `http://${host}:${(this.server.address() as AddressInfo).port}`;
    if (inProcess) this.install();
  }

  get url(): string {
    return this.baseUrl;
  }

  /** The identity the next consent of this provider gives (consent page of a browser). */
  announce(provider: FakeProvider, identity: FakeIdentity): void {
    this.nextIdentities.set(provider, [...(this.nextIdentities.get(provider) ?? []), identity]);
  }

  async stop(): Promise<void> {
    if (this.originalFetch) globalThis.fetch = this.originalFetch;
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }

  /** What the provider would return to the callback after the user consents. */
  issueCode(provider: FakeProvider, identity: FakeIdentity): string {
    const code = randomUUID();
    this.codes.set(code, { provider, identity });
    return code;
  }

  /**
   * Holds the next token request until `release()` is called, to observe the api while it waits
   * for the provider. `reached` resolves once the request has arrived.
   */
  pauseNextTokenRequest(): { reached: Promise<void>; release: () => void } {
    let reached!: () => void;
    let release!: () => void;
    const arrived = new Promise<void>((resolve) => (reached = resolve));
    const released = new Promise<void>((resolve) => (release = resolve));
    this.pausedTokenRequest = { reached, released };
    return { reached: arrived, release };
  }

  private install(): void {
    const original = globalThis.fetch;
    this.originalFetch = original;
    globalThis.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      const route = PROVIDER_ROUTES[url.split('?')[0] ?? ''];
      return original(route ? `${this.baseUrl}${route}` : input, init);
    };
  }

  private idToken(provider: FakeProvider, identity: FakeIdentity): string {
    const now = Math.floor(Date.now() / 1000);
    const claims =
      provider === 'microsoft'
        ? {
            iss: 'https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0',
            tid: '9188040d-6c67-4c5b-b112-36a304b66dad',
            oid: identity.subject,
            sub: identity.subject,
            aud: 'microsoft-client',
            email: identity.email,
            name: identity.name,
          }
        : {
            iss: 'https://accounts.google.com',
            sub: identity.subject,
            aud: 'google-client',
            email: identity.email,
            email_verified: identity.emailVerified,
            name: identity.name,
            picture: identity.picture,
          };
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test' }));
    const payload = base64url(JSON.stringify({ ...claims, iat: now, exp: now + 3600 }));
    const signature = sign('RSA-SHA256', Buffer.from(`${header}.${payload}`), this.keys.privateKey);
    return `${header}.${payload}.${base64url(signature)}`;
  }

  private async reply(request: IncomingMessage): Promise<Reply> {
    const url = new URL(request.url ?? '/', 'http://fake');
    if (url.pathname === '/__health') return { status: 200, body: { ok: true } };
    if (request.method === 'POST' && url.pathname === '/__identity') {
      const { provider, identity } = JSON.parse(await readRaw(request)) as {
        provider: FakeProvider;
        identity: FakeIdentity;
      };
      this.announce(provider, identity);
      return { status: 204 };
    }
    const [, provider, endpoint] = url.pathname.split('/') as [string, FakeProvider, string];
    if (endpoint === 'authorize') return this.consent(provider, url.searchParams);
    const body = await this.handle(request, provider, endpoint);
    return body ? { status: 200, body } : { status: 400, body: { error: 'invalid_grant' } };
  }

  /** Consent of the browser: the next announced identity, then back to the callback. */
  private consent(provider: FakeProvider, query: URLSearchParams): Reply {
    const callback = query.get('redirect_uri');
    const identity = this.nextIdentities.get(provider)?.shift();
    if (!callback || !identity) return { status: 400, body: { error: 'no_identity_announced' } };
    const target = new URL(callback);
    target.searchParams.set('code', this.issueCode(provider, identity));
    const state = query.get('state');
    if (state) target.searchParams.set('state', state);
    return { status: 302, location: target.toString() };
  }

  private async handle(
    request: IncomingMessage,
    provider: FakeProvider,
    endpoint: string,
  ): Promise<object | undefined> {
    if (endpoint === 'userinfo') {
      const token = request.headers.authorization?.replace('Bearer ', '') ?? '';
      const identity = this.accessTokens.get(token);
      return identity
        ? {
            sub: identity.subject,
            email: identity.email,
            email_verified: identity.emailVerified,
            name: identity.name,
            picture: identity.picture,
          }
        : undefined;
    }
    const body = new URLSearchParams(await readRaw(request));
    const paused = this.pausedTokenRequest;
    if (paused) {
      this.pausedTokenRequest = undefined;
      paused.reached();
      await paused.released;
    }
    const grant = this.codes.get(body.get('code') ?? '');
    if (!grant || grant.provider !== provider) return undefined;
    this.codes.delete(body.get('code') ?? '');
    const accessToken = randomUUID();
    this.accessTokens.set(accessToken, grant.identity);
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid email profile',
      ...(provider === 'linkedin' ? {} : { id_token: this.idToken(provider, grant.identity) }),
    };
  }
}

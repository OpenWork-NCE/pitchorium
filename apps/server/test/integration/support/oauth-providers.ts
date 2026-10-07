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
const ROUTES: Readonly<Record<string, string>> = {
  'https://oauth2.googleapis.com/token': '/google/token',
  'https://www.linkedin.com/oauth/v2/accessToken': '/linkedin/token',
  'https://api.linkedin.com/v2/userinfo': '/linkedin/userinfo',
  'https://login.microsoftonline.com/common/oauth2/v2.0/token': '/microsoft/token',
};

const base64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');

async function readBody(request: IncomingMessage): Promise<URLSearchParams> {
  let raw = '';
  for await (const chunk of request) raw += String(chunk);
  return new URLSearchParams(raw);
}

/**
 * Local OIDC/OAuth 2 server standing in for Google, LinkedIn and Microsoft. `install()` reroutes
 * the provider URLs used by Better Auth (global fetch) to this server; the authorization step,
 * which happens in the browser, is replaced by issueCode().
 */
export class FakeOAuthProviders {
  private server: Server | undefined;
  private baseUrl = '';
  private readonly codes = new Map<string, { provider: FakeProvider; identity: FakeIdentity }>();
  private readonly accessTokens = new Map<string, FakeIdentity>();
  private readonly keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  private originalFetch: typeof fetch | undefined;
  private pausedTokenRequest: { reached: () => void; released: Promise<void> } | undefined;

  async start(): Promise<void> {
    this.server = createServer((request, response) => {
      void this.handle(request).then(
        (body) => {
          response.writeHead(body ? 200 : 400, { 'content-type': 'application/json' });
          response.end(JSON.stringify(body ?? { error: 'invalid_grant' }));
        },
        () => response.writeHead(500).end(),
      );
    });
    await new Promise<void>((resolve) => this.server?.listen(0, '127.0.0.1', resolve));
    this.baseUrl = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
    this.install();
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
      const route = ROUTES[url.split('?')[0] ?? ''];
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

  private async handle(request: IncomingMessage): Promise<object | undefined> {
    const [, provider, endpoint] = (request.url ?? '').split('/') as [string, FakeProvider, string];
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
    const body = await readBody(request);
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

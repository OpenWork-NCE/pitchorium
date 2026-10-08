import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import { inject, vi } from 'vitest';
import { totp } from '../../integration/support/totp';

export const DEMO_PASSWORD = 'pitchorium-demo-2026';
export const demoEmail = (handle: string) => `${handle.replaceAll('-', '.')}@demo.pitchorium.test`;

export interface Reply<T = any> {
  status: number;
  body: T;
}

/**
 * A browser of the web application: session cookie kept between calls, trusted Origin, an
 * Idempotency-Key on every write, as the frontend sends them (docs/frontend-handoff.md).
 */
export class Browser {
  private cookie = '';
  readonly api = inject('apiUrl');

  async call<T = any>(method: string, path: string, body?: unknown): Promise<Reply<T>> {
    const response = await fetch(`${this.api}${path}`, {
      method,
      redirect: 'manual',
      headers: {
        origin: inject('webOrigin'),
        cookie: this.cookie,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(method === 'GET' ? {} : { 'idempotency-key': randomUUID() }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) this.cookie = cookies.map((cookie) => cookie.split(';')[0]).join('; ');
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON (a redirect, a calendar): kept as text.
    }
    return { status: response.status, body: parsed as T };
  }

  get = <T = any>(path: string) => this.call<T>('GET', path);
  post = <T = any>(path: string, body?: unknown) => this.call<T>('POST', path, body ?? {});

  async signIn(email: string, password = DEMO_PASSWORD): Promise<this> {
    const signed = await this.post('/v1/auth/sign-in/email', { email, password });
    if (signed.status !== 200) throw new Error(`Sign-in of ${email}: ${signed.status}`);
    return this;
  }

  /** Enables TOTP two-factor authentication, required of moderators and administrators. */
  async enableTwoFactor(password = DEMO_PASSWORD): Promise<void> {
    const enabled = await this.post<{ totpURI: string }>('/v1/auth/two-factor/enable', {
      password,
    });
    if (enabled.status !== 200) throw new Error(`2FA enable: ${enabled.status}`);
    const verified = await this.post('/v1/auth/two-factor/verify-totp', {
      code: totp(enabled.body.totpURI),
    });
    if (verified.status !== 200) throw new Error(`2FA verify: ${verified.status}`);
  }

  /** A Socket.IO connection with the session, as the web application opens it. */
  socket(): Promise<Socket> {
    const socket = io(`${this.api}/`, {
      transports: ['websocket'],
      extraHeaders: { cookie: this.cookie, origin: inject('webOrigin') },
      reconnection: false,
    });
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }
}

export async function demo(handle: string): Promise<Browser> {
  return new Browser().signIn(demoEmail(handle));
}

/** Retries `read` until `accept` holds: the worker processes events asynchronously. */
export function eventually<T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  timeout = 30_000,
): Promise<T> {
  return vi.waitFor(
    async () => {
      const value = await read();
      if (!accept(value)) throw new Error(`Not yet: ${JSON.stringify(value).slice(0, 300)}`);
      return value;
    },
    { timeout, interval: 500 },
  );
}

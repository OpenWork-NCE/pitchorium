import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimePublisher } from '../../src/platform/realtime';
import { createApiTestApp } from './support/api-app';
import { truncateAllTables } from './support/database';
import { TEST_WEB_APP_URL } from './support/environment';
import { browser, signIn, signUp } from './support/members';

describe('Socket.IO handshake', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    ({ app } = await createApiTestApp());
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  /** Resolves with "connected" or the handshake error message. */
  function connect(namespace: string, headers: Record<string, string>): Promise<string> {
    const socket = io(`${baseUrl}${namespace}`, {
      transports: ['websocket'],
      extraHeaders: headers,
      reconnection: false,
    });
    sockets.push(socket);
    return new Promise((resolve) => {
      socket.on('connect', () => resolve('connected'));
      socket.on('connect_error', (error) => resolve(error.message));
    });
  }

  it('accepts an authenticated member and refuses anonymous or foreign connections', async () => {
    const agent = browser(app);
    await signUp(agent, 'socket@example.com');
    const cookie = await signIn(agent, 'socket@example.com');

    expect(await connect('/', { cookie, origin: TEST_WEB_APP_URL })).toBe('connected');
    expect(await connect('/', { origin: TEST_WEB_APP_URL })).toBe('unauthorized');
    expect(await connect('/', { cookie, origin: 'https://evil.example' })).toBe('unauthorized');
    expect(
      await connect('/', { cookie: 'pitchorium.session_token=forged', origin: TEST_WEB_APP_URL }),
    ).toBe('unauthorized');
  });

  it('pushes to every device of a member through the Redis channel, and to them only', async () => {
    const agent = browser(app);
    await signUp(agent, 'devices@example.com');
    const cookie = await signIn(agent, 'devices@example.com');
    const other = browser(app);
    await signUp(other, 'other-device@example.com');
    const otherCookie = await signIn(other, 'other-device@example.com');
    const userId = (await agent.get('/v1/me').expect(200)).body.user.id as string;

    const open = async (headers: Record<string, string>) => {
      const socket = io(`${baseUrl}/`, {
        transports: ['websocket'],
        extraHeaders: headers,
        reconnection: false,
      });
      sockets.push(socket);
      await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
      const received: unknown[] = [];
      socket.on('test:push', (payload: unknown) => received.push(payload));
      return received;
    };
    const laptop = await open({ cookie, origin: TEST_WEB_APP_URL });
    const phone = await open({ cookie, origin: TEST_WEB_APP_URL });
    const stranger = await open({ cookie: otherCookie, origin: TEST_WEB_APP_URL });

    app.get(RealtimePublisher).toUsers([userId], 'test:push', { n: 1 });
    await vi.waitFor(() => {
      expect(laptop).toEqual([{ n: 1 }]);
      expect(phone).toEqual([{ n: 1 }]);
    });
    expect(stranger).toEqual([]);
  });

  it('keeps the technical namespace open', async () => {
    expect(await connect('/system', {})).toBe('connected');
  });
});

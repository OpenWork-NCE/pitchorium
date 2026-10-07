import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Namespace, Server, ServerOptions } from 'socket.io';
import { createRedisClient } from '../redis';
import type { RealtimeHandshakeGuard } from './handshake-guard';

/** Socket.IO adapter that fans events out through Redis, so several api instances can run. */
export class RedisIoAdapter extends IoAdapter {
  private pubClient: Redis | undefined;
  private subClient: Redis | undefined;

  constructor(
    app: INestApplicationContext,
    private readonly redisUrl: string,
    private readonly corsOrigins: string[],
    private readonly guard: RealtimeHandshakeGuard,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    this.pubClient ??= createRedisClient(this.redisUrl, 'pitchorium-socket-pub');
    this.subClient ??= this.pubClient.duplicate({ connectionName: 'pitchorium-socket-sub' });
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigins.length > 0 ? this.corsOrigins : false, credentials: true },
    }) as Server;
    server.adapter(createAdapter(this.pubClient, this.subClient));

    const protect = (namespace: Namespace) =>
      namespace.use((socket, next) => {
        this.guard
          .authorize(socket)
          .then((allowed) => next(allowed ? undefined : new Error('unauthorized')))
          .catch(() => next(new Error('unauthorized')));
      });
    protect(server.of('/'));
    server.on('new_namespace', protect);
    return server;
  }

  override async dispose(): Promise<void> {
    await super.dispose();
    await Promise.all([this.pubClient?.quit(), this.subClient?.quit()]);
  }
}

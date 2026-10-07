import { Inject, Injectable, Logger } from '@nestjs/common';
import { Emitter } from '@socket.io/redis-emitter';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis';

/** Namespace of the signed-in members (every namespace but `/system` requires a session). */
export const MEMBERS_NAMESPACE = '/';

/** Room joined by every socket of a member, whatever the device (ADR 0056). */
export function userRoom(userId: string): string {
  return `user:${userId}`;
}

/**
 * Port: pushes an event to every connected device of some members, from the api or the
 * worker. Best effort: a member offline, or a lost push, catches up by the HTTP reads.
 */
export abstract class RealtimePublisher {
  abstract toUsers(userIds: readonly string[], event: string, payload: unknown): void;
}

/**
 * Publishes through the Redis channel of the Socket.IO adapter (@socket.io/redis-emitter), so
 * that a worker reaches the sockets held by any api instance.
 */
@Injectable()
export class RedisRealtimePublisher extends RealtimePublisher {
  private readonly logger = new Logger(RedisRealtimePublisher.name);
  private readonly emitter: Emitter;

  constructor(@Inject(REDIS) redis: Redis) {
    super();
    this.emitter = new Emitter(redis).of(MEMBERS_NAMESPACE);
  }

  toUsers(userIds: readonly string[], event: string, payload: unknown): void {
    const rooms = [...new Set(userIds)].map(userRoom);
    if (rooms.length === 0) return;
    try {
      this.emitter.to(rooms).emit(event, payload);
    } catch (error) {
      this.logger.warn(`Realtime push ${event} failed: ${(error as Error).message}`);
    }
  }
}

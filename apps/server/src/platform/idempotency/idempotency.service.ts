import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type Database, idempotencyKeys } from '@pitchorium/db';
import { and, eq, lt, sql } from '@pitchorium/db/orm';
import { DATABASE } from '../database';
import { Clock } from '../kernel';

export type IdempotencyClaim =
  | { kind: 'acquired' }
  | { kind: 'replay'; status: number; body: unknown }
  | { kind: 'in-progress' }
  | { kind: 'mismatch' };

export function fingerprintRequest(method: string, path: string, body: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify({ method, path, body: body ?? null }))
    .digest('hex');
}

/**
 * Stores idempotency keys outside of business transactions: the claim must be visible to
 * concurrent requests before the handler runs.
 */
@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async claim(
    scope: string,
    key: string,
    fingerprint: string,
    ttlMs: number,
  ): Promise<IdempotencyClaim> {
    const now = this.clock.now();
    const claimed = await this.db
      .insert(idempotencyKeys)
      .values({
        scope,
        key,
        requestFingerprint: fingerprint,
        createdAt: now,
        expiresAt: new Date(now.getTime() + ttlMs),
      })
      .onConflictDoUpdate({
        target: [idempotencyKeys.scope, idempotencyKeys.key],
        set: {
          requestFingerprint: fingerprint,
          responseStatus: null,
          responseBody: null,
          createdAt: now,
          expiresAt: new Date(now.getTime() + ttlMs),
        },
        // Only an expired key may be taken over.
        setWhere: lt(idempotencyKeys.expiresAt, now),
      })
      .returning({ key: idempotencyKeys.key });
    if (claimed.length > 0) {
      return { kind: 'acquired' };
    }

    const [existing] = await this.db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)));
    if (!existing) {
      return this.claim(scope, key, fingerprint, ttlMs);
    }
    if (existing.requestFingerprint !== fingerprint) {
      return { kind: 'mismatch' };
    }
    if (existing.responseStatus === null) {
      return { kind: 'in-progress' };
    }
    return { kind: 'replay', status: existing.responseStatus, body: existing.responseBody };
  }

  async complete(scope: string, key: string, status: number, body: unknown): Promise<void> {
    await this.db
      .update(idempotencyKeys)
      .set({ responseStatus: status, responseBody: sql`${JSON.stringify(body ?? null)}::jsonb` })
      .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)));
  }

  /** Called when the handler fails, so that the client can retry with the same key. */
  async release(scope: string, key: string): Promise<void> {
    await this.db
      .delete(idempotencyKeys)
      .where(and(eq(idempotencyKeys.scope, scope), eq(idempotencyKeys.key, key)));
  }

  async purgeExpired(): Promise<number> {
    const deleted = await this.db
      .delete(idempotencyKeys)
      .where(lt(idempotencyKeys.expiresAt, this.clock.now()))
      .returning({ key: idempotencyKeys.key });
    return deleted.length;
  }
}

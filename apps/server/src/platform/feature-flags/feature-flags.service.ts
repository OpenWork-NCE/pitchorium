import { Inject, Injectable } from '@nestjs/common';
import { type Database, featureFlags } from '@pitchorium/db';
import { eq } from '@pitchorium/db/orm';
import { DATABASE, TransactionManager } from '../database';
import { Clock } from '../kernel';

export const FEATURE_FLAGS_CACHE_TTL_MS = 10_000;

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  updatedAt: Date;
}

/**
 * Feature flags. The whole table is small and cached for a few seconds, so a change is visible
 * everywhere within the TTL. Flags are created by `pnpm db:seed`; only the administration
 * changes their state (`set`), with its own guardrails and audit.
 */
@Injectable()
export class FeatureFlagsService {
  private cache: { flags: ReadonlyMap<string, boolean>; expiresAt: number } | undefined;
  private loading: Promise<ReadonlyMap<string, boolean>> | undefined;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly clock: Clock,
    private readonly transactions: TransactionManager,
  ) {}

  /** Every flag with its description, by key. */
  async list(): Promise<FeatureFlag[]> {
    const rows = await this.transactions.executor
      .select()
      .from(featureFlags)
      .orderBy(featureFlags.key);
    return rows.map((row) => ({
      key: row.key,
      enabled: row.enabled,
      description: row.description,
      updatedAt: row.updatedAt,
    }));
  }

  /** Changes a flag in the current transaction; false when it does not exist. */
  async set(key: string, enabled: boolean): Promise<boolean> {
    const updated = await this.transactions.executor
      .update(featureFlags)
      .set({ enabled, updatedAt: this.clock.now() })
      .where(eq(featureFlags.key, key))
      .returning({ key: featureFlags.key });
    this.invalidate();
    return updated.length > 0;
  }

  /** Unknown flags are disabled. */
  async isEnabled(key: string): Promise<boolean> {
    return (await this.flags()).get(key) ?? false;
  }

  async all(): Promise<ReadonlyMap<string, boolean>> {
    return this.flags();
  }

  invalidate(): void {
    this.cache = undefined;
  }

  private async flags(): Promise<ReadonlyMap<string, boolean>> {
    const now = this.clock.now().getTime();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.flags;
    }
    this.loading ??= this.load(now).finally(() => {
      this.loading = undefined;
    });
    return this.loading;
  }

  private async load(now: number): Promise<ReadonlyMap<string, boolean>> {
    const rows = await this.db
      .select({ key: featureFlags.key, enabled: featureFlags.enabled })
      .from(featureFlags);
    const flags = new Map(rows.map((row) => [row.key, row.enabled]));
    this.cache = { flags, expiresAt: now + FEATURE_FLAGS_CACHE_TTL_MS };
    return flags;
  }
}

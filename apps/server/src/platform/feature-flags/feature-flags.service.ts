import { Inject, Injectable } from '@nestjs/common';
import { type Database, featureFlags } from '@pitchorium/db';
import { DATABASE } from '../database';
import { Clock } from '../kernel';

export const FEATURE_FLAGS_CACHE_TTL_MS = 10_000;

/**
 * Read-only access to feature flags. The whole table is small and cached for a few seconds,
 * so a change made in the database is visible everywhere within the TTL.
 */
@Injectable()
export class FeatureFlagsService {
  private cache: { flags: ReadonlyMap<string, boolean>; expiresAt: number } | undefined;
  private loading: Promise<ReadonlyMap<string, boolean>> | undefined;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly clock: Clock,
  ) {}

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

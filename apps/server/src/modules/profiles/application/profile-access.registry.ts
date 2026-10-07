import { Injectable } from '@nestjs/common';
import type { ProfileAccessFilter } from './ports';

const NOBODY: ReadonlySet<string> = new Set();

/**
 * Holds the access filter registered by the network module. Safe by default: until a filter is
 * registered, every profile stays visible, as before blocks existed.
 */
@Injectable()
export class ProfileAccessRegistry {
  private filter: ProfileAccessFilter | undefined;

  register(filter: ProfileAccessFilter): void {
    if (this.filter) throw new Error('A profile access filter is already registered');
    this.filter = filter;
  }

  /** Members among `userIds` hidden from the viewer; none for an anonymous reader. */
  async hiddenFrom(
    viewerId: string | null,
    userIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    const others = userIds.filter((id) => id !== viewerId);
    if (!this.filter || viewerId === null || others.length === 0) return NOBODY;
    return this.filter.hiddenFrom(viewerId, others);
  }

  async isHidden(viewerId: string | null, userId: string): Promise<boolean> {
    return (await this.hiddenFrom(viewerId, [userId])).has(userId);
  }
}

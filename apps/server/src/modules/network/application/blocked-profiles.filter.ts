import { Injectable, type OnModuleInit } from '@nestjs/common';
import { type ProfileAccessFilter, ProfilesFacade } from '../../profiles';
import { NetworkRepository } from './ports';

/**
 * Hides the profile of a member from everyone on either side of a block with them (ADR 0029),
 * registered with the profiles module at startup so that profiles does not depend on network.
 */
@Injectable()
export class BlockedProfilesFilter implements ProfileAccessFilter, OnModuleInit {
  constructor(
    private readonly network: NetworkRepository,
    private readonly profiles: ProfilesFacade,
  ) {}

  onModuleInit(): void {
    this.profiles.registerProfileAccessFilter(this);
  }

  async hiddenFrom(viewerId: string, userIds: readonly string[]): Promise<ReadonlySet<string>> {
    const blocked = new Set(await this.network.blockedIds(viewerId));
    return new Set(userIds.filter((id) => blocked.has(id)));
  }
}

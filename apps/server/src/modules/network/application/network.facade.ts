import { Injectable } from '@nestjs/common';
import type { RelationDegree } from '@pitchorium/contracts';
import { FollowTargetRegistry, MEMBER_TARGET } from './follow-target.registry';
import { type FollowTargetType, NetworkRepository } from './ports';

/** Public facade of the network module, for content, messaging and the owners of targets. */
@Injectable()
export class NetworkFacade {
  constructor(
    private readonly network: NetworkRepository,
    private readonly targets: FollowTargetRegistry,
  ) {}

  /** Members on either side of a block with this member: hidden from them, no interaction. */
  blockedUserIds(userId: string): Promise<string[]> {
    return this.network.blockedIds(userId);
  }

  async isBlockedBetween(a: string, b: string): Promise<boolean> {
    const blocks = await this.network.blocksBetween(a, b);
    return blocks.byA || blocks.byB;
  }

  /** Targets of a type a member follows (feed composition). */
  followedIds(userId: string, targetType: string): Promise<string[]> {
    return this.network.followedIds(userId, targetType);
  }

  followedMemberIds(userId: string): Promise<string[]> {
    return this.network.followedIds(userId, MEMBER_TARGET);
  }

  connectionIds(userId: string): Promise<string[]> {
    return this.network.connectionIds(userId);
  }

  areConnected(a: string, b: string): Promise<boolean> {
    return this.network.areConnected(a, b);
  }

  /** Degree of relation from `a` to `b`, up to the second degree (messaging eligibility). */
  async degreeBetween(a: string, b: string): Promise<RelationDegree> {
    if (a === b) return 'self';
    if (await this.network.areConnected(a, b)) return 'first';
    return (await this.network.countMutualConnections(a, b, 1)) > 0 ? 'second' : 'out_of_network';
  }

  /** Called at startup by the module owning a kind of target (organizations, projects). */
  registerFollowTargetType(type: FollowTargetType): void {
    this.targets.register(type);
  }
}

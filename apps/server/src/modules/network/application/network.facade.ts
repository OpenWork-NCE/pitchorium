import { Injectable } from '@nestjs/common';
import type { RelationDegree } from '@pitchorium/contracts';
import { FollowTargetRegistry, MEMBER_TARGET } from './follow-target.registry';
import { Clock } from '../../../platform/kernel';
import { type FollowTargetType, NetworkRepository, type ProfileViewsOfDay } from './ports';

/** Public facade of the network module, for content, messaging and the owners of targets. */
@Injectable()
export class NetworkFacade {
  constructor(
    private readonly network: NetworkRepository,
    private readonly targets: FollowTargetRegistry,
    private readonly clock: Clock,
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

  /** Followers of a target by ascending id after a cursor (batched notifications). */
  followerIds(
    targetType: string,
    targetId: string,
    afterFollowerId: string | null,
    limit: number,
  ): Promise<string[]> {
    return this.network.followerIdsAfter(targetType, targetId, afterFollowerId, limit);
  }

  /** Pending connection requests a member received (unified counters). */
  pendingConnectionRequests(userId: string): Promise<number> {
    return this.network.countPendingReceived(userId, this.clock.now());
  }

  /**
   * Profile views of one UTC day by viewed member, private visitors counted but never named
   * (notification « vues de profil »).
   */
  profileViewsOfDay(
    day: string,
    afterViewedId: string | null,
    limit: number,
  ): Promise<ProfileViewsOfDay[]> {
    return this.network.profileViewsOfDay(day, afterViewedId, limit);
  }

  /** Called at startup by the module owning a kind of target (organizations, projects). */
  registerFollowTargetType(type: FollowTargetType): void {
    this.targets.register(type);
  }
}

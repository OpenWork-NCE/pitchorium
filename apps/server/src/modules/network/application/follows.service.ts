import { Injectable } from '@nestjs/common';
import type { Follow, FollowState } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError } from '../../../platform/kernel';
import { FollowCreated, FollowRemoved } from '../domain/network-events';
import { FollowTargetRegistry, MEMBER_TARGET } from './follow-target.registry';
import { NetworkEventsRecorder } from './network-events.recorder';
import { NetworkRepository } from './ports';

/** Unilateral follows of any registered target (§10.2, ADR 0027). */
@Injectable()
export class FollowsService {
  constructor(
    private readonly network: NetworkRepository,
    private readonly targets: FollowTargetRegistry,
    private readonly events: NetworkEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  async follow(userId: string, targetType: string, targetKey: string): Promise<Follow> {
    const targetId = await this.targets.resolve(targetType, targetKey);
    if (targetType === MEMBER_TARGET) await this.assertMemberReachable(userId, targetId);
    const existing = await this.network.findFollow(userId, targetType, targetId);
    const followedAt =
      existing?.createdAt ??
      (await this.transactions.run(async () => {
        const now = this.clock.now();
        const created = await this.network.insertFollow({
          followerId: userId,
          targetType,
          targetId,
          origin: 'manual',
          createdAt: now,
        });
        if (created) {
          await this.events.record(FollowCreated, userId, {
            targetType,
            targetId,
            origin: 'manual',
          });
        }
        return now;
      }));
    const summary = (await this.targets.describe(targetType, [targetId])).get(targetId);
    if (!summary) throw new DomainError('NETWORK_TARGET_NOT_FOUND', 'Follow target not found');
    return { target: { type: targetType, ...summary }, followedAt: followedAt.toISOString() };
  }

  /** Whether the reader follows a target, and how many members do (not for a member). */
  async state(userId: string, targetType: string, targetKey: string): Promise<FollowState> {
    const targetId = await this.targets.resolve(targetType, targetKey);
    if (targetType === MEMBER_TARGET) await this.assertMemberReachable(userId, targetId);
    const [follow, followers] = await Promise.all([
      this.network.findFollow(userId, targetType, targetId),
      targetType === MEMBER_TARGET
        ? Promise.resolve(null)
        : this.network.countFollowers(targetType, targetId),
    ]);
    return { following: follow !== null, followers };
  }

  /** Stopping to follow a connection keeps the connection (ADR 0028). */
  async unfollow(userId: string, targetType: string, targetKey: string): Promise<void> {
    const targetId = await this.targets.resolve(targetType, targetKey);
    await this.transactions.run(async () => {
      if (await this.network.deleteFollow(userId, targetType, targetId)) {
        await this.events.record(FollowRemoved, userId, {
          targetType,
          targetId,
          reason: 'unfollowed',
        });
      }
    });
  }

  /** Neither yourself nor a member on either side of a block (a block of yours is said). */
  private async assertMemberReachable(userId: string, memberId: string): Promise<void> {
    if (memberId === userId) {
      throw new DomainError('NETWORK_SELF_RELATION', 'A member cannot follow themselves');
    }
    const blocks = await this.network.blocksBetween(userId, memberId);
    if (blocks.byB) throw new DomainError('NETWORK_MEMBER_NOT_FOUND', 'Member not found');
    if (blocks.byA) throw new DomainError('NETWORK_MEMBER_BLOCKED', 'You blocked this member');
  }
}

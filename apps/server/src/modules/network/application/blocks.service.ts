import { Injectable } from '@nestjs/common';
import type { Block, CursorPage, CursorPageQuery } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, decodeKeyset, encodeKeyset } from '../../../platform/kernel';
import { blockEffects } from '../domain/block-effects';
import {
  BlockCreated,
  BlockRemoved,
  ConnectionRemoved,
  FollowRemoved,
} from '../domain/network-events';
import { pairLock } from './connections.service';
import { MEMBER_TARGET } from './follow-target.registry';
import { MemberDirectory } from './member-directory';
import { NetworkEventsRecorder } from './network-events.recorder';
import { NetworkRepository } from './ports';

/**
 * Blocking (ADR 0029): removes every relation between the two members and forbids new ones;
 * content and messaging read the blocks through the facade to hide and refuse interactions.
 */
@Injectable()
export class BlocksService {
  constructor(
    private readonly network: NetworkRepository,
    private readonly members: MemberDirectory,
    private readonly events: NetworkEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  async block(userId: string, handle: string): Promise<void> {
    const blockedId = await this.members.require(handle);
    if (blockedId === userId) {
      throw new DomainError('NETWORK_SELF_RELATION', 'A member cannot block themselves');
    }
    await this.transactions.run(async () => {
      await this.network.lock(pairLock(userId, blockedId));
      const now = this.clock.now();
      if (!(await this.network.insertBlock({ blockerId: userId, blockedId, createdAt: now }))) {
        return;
      }
      const pending = await this.network.pendingBetween(userId, blockedId);
      const effects = blockEffects({
        connected: await this.network.areConnected(userId, blockedId),
        follows: await this.network.memberFollowsBetween(userId, blockedId),
        pendingRequestIds: pending ? [pending.id] : [],
      });
      if (effects.removeConnection) {
        await this.network.deleteConnection(userId, blockedId);
        await this.events.record(ConnectionRemoved, userId, {
          peerId: blockedId,
          reason: 'blocked',
        });
      }
      for (const follow of effects.removedFollows) {
        await this.network.deleteFollow(follow.followerId, MEMBER_TARGET, follow.targetId);
        await this.events.record(FollowRemoved, follow.followerId, {
          targetType: MEMBER_TARGET,
          targetId: follow.targetId,
          reason: follow.reason,
        });
      }
      for (const requestId of effects.cancelledRequestIds) {
        await this.network.closeRequest(requestId, 'cancelled', now);
      }
      await this.events.record(BlockCreated, userId, { blockedId });
    });
  }

  async unblock(userId: string, handle: string): Promise<void> {
    const blockedId = await this.members.require(handle);
    await this.transactions.run(async () => {
      if (await this.network.deleteBlock(userId, blockedId)) {
        await this.events.record(BlockRemoved, userId, { blockedId });
      }
    });
  }

  async list(userId: string, query: CursorPageQuery): Promise<CursorPage<Block>> {
    const rows = await this.network.blocks(userId, {
      after: decodeKeyset(query.cursor),
      limit: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    const cards = await this.members.cards(page.map((row) => row.blockedId));
    const last = page.at(-1);
    return {
      items: page.flatMap((row) => {
        const member = cards.get(row.blockedId);
        return member ? [{ member, blockedAt: row.createdAt.toISOString() }] : [];
      }),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.createdAt, key: last.blockedId })
          : null,
    };
  }
}

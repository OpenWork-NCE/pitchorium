import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { MemberCard } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import { ProfilesFacade } from '../../profiles';
import { FollowTargetRegistry, MEMBER_TARGET } from './follow-target.registry';
import type { FollowTargetSummary, FollowTargetType } from './ports';

/**
 * Members as network sees them, through the profiles facade: a handle (current or former) to
 * address them, a card to show them, never their user id. Also the `member` follow target.
 */
@Injectable()
export class MemberDirectory implements FollowTargetType, OnModuleInit {
  readonly type = MEMBER_TARGET;

  constructor(
    private readonly profiles: ProfilesFacade,
    private readonly targets: FollowTargetRegistry,
  ) {}

  onModuleInit(): void {
    this.targets.register(this);
  }

  /** User id of a member addressed by handle; 404 for an unknown handle. */
  async require(handle: string): Promise<string> {
    const userId = await this.profiles.userIdOf(handle);
    if (!userId) throw new DomainError('NETWORK_MEMBER_NOT_FOUND', 'Member not found');
    return userId;
  }

  async cards(userIds: readonly string[]): Promise<Map<string, MemberCard>> {
    const cards = new Map<string, MemberCard>();
    for (const [userId, card] of await this.profiles.memberCards([...new Set(userIds)])) {
      cards.set(userId, {
        handle: card.handle,
        displayName: card.displayName,
        headline: card.headline,
        avatarUrl: card.avatarUrl,
      });
    }
    return cards;
  }

  resolve(key: string): Promise<string | null> {
    return this.profiles.userIdOf(key);
  }

  async describe(ids: readonly string[]): Promise<Map<string, FollowTargetSummary>> {
    const summaries = new Map<string, FollowTargetSummary>();
    for (const [id, card] of await this.cards(ids)) {
      summaries.set(id, {
        key: card.handle,
        displayName: card.displayName,
        subtitle: card.headline,
        imageUrl: card.avatarUrl,
        slug: card.handle,
      });
    }
    return summaries;
  }
}

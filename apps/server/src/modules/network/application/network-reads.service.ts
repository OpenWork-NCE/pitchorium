import { Inject, Injectable } from '@nestjs/common';
import type {
  Connection,
  ConnectionRequest,
  ConnectionRequestDirection,
  CursorPage,
  CursorPageQuery,
  Follow,
  Follower,
  Relationship,
} from '@pitchorium/contracts';
import { API_CONFIG, type ApiConfig } from '../../../platform/config';
import { Clock, DomainError, decodeKeyset, encodeKeyset } from '../../../platform/kernel';
import { ProfilesFacade } from '../../profiles';
import {
  canSeeNetworkLists,
  connectionStateOf,
  degreeOf,
  type ListAudience,
} from '../domain/relationship';
import { requestView } from './connections.service';
import { FollowTargetRegistry, MEMBER_TARGET } from './follow-target.registry';
import { MemberDirectory } from './member-directory';
import { NetworkRepository } from './ports';

/** Who reads: a member (`viewerId`) or an anonymous visitor of a public page. */
export type NetworkReader = { viewerId: string } | { viewerId: null };

/** Lists and relationships, with the privacy of lists and the blocks applied. */
@Injectable()
export class NetworkReadsService {
  constructor(
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    private readonly network: NetworkRepository,
    private readonly members: MemberDirectory,
    private readonly targets: FollowTargetRegistry,
    private readonly profiles: ProfilesFacade,
    private readonly clock: Clock,
  ) {}

  async followersOfMember(
    reader: NetworkReader,
    handle: string,
    query: CursorPageQuery,
  ): Promise<CursorPage<Follower>> {
    const { ownerId, excluded } = await this.listAccess(reader, handle);
    return this.followerPage(MEMBER_TARGET, ownerId, excluded, query);
  }

  /** Followers of a target that is not a member (an organization): visible to members. */
  async followersOfTarget(
    viewerId: string,
    targetType: string,
    targetKey: string,
    query: CursorPageQuery,
  ): Promise<CursorPage<Follower>> {
    const targetId = await this.targets.resolve(targetType, targetKey);
    if (targetType === MEMBER_TARGET) {
      const handle = (await this.members.cards([targetId])).get(targetId)?.handle;
      if (!handle) throw new DomainError('NETWORK_TARGET_NOT_FOUND', 'Follow target not found');
      return this.followersOfMember({ viewerId }, handle, query);
    }
    return this.followerPage(targetType, targetId, await this.network.blockedIds(viewerId), query);
  }

  async followingOfMember(
    reader: NetworkReader,
    handle: string,
    targetType: string | undefined,
    query: CursorPageQuery,
  ): Promise<CursorPage<Follow>> {
    const { ownerId, excluded } = await this.listAccess(reader, handle);
    const rows = await this.network.following(ownerId, targetType, {
      after: decodeKeyset(query.cursor),
      limit: query.limit + 1,
      excludedUserIds: excluded,
    });
    const page = rows.slice(0, query.limit);
    const byType = new Map<string, string[]>();
    for (const row of page)
      byType.set(row.targetType, [...(byType.get(row.targetType) ?? []), row.targetId]);
    const summaries = new Map<string, Awaited<ReturnType<FollowTargetRegistry['describe']>>>();
    for (const [type, ids] of byType) summaries.set(type, await this.targets.describe(type, ids));
    const last = page.at(-1);
    return {
      items: page.flatMap((row) => {
        const summary = summaries.get(row.targetType)?.get(row.targetId);
        return summary
          ? [
              {
                target: { type: row.targetType, ...summary },
                followedAt: row.createdAt.toISOString(),
              },
            ]
          : [];
      }),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.createdAt, key: last.targetId })
          : null,
    };
  }

  async connectionsOfMember(
    reader: NetworkReader,
    handle: string,
    query: CursorPageQuery,
  ): Promise<CursorPage<Connection>> {
    const { ownerId, excluded } = await this.listAccess(reader, handle);
    const rows = await this.network.connections(ownerId, {
      after: decodeKeyset(query.cursor),
      limit: query.limit + 1,
      excludedUserIds: excluded,
    });
    const page = rows.slice(0, query.limit);
    const cards = await this.members.cards(page.map((row) => row.peerId));
    const last = page.at(-1);
    return {
      items: page.flatMap((row) => {
        const member = cards.get(row.peerId);
        return member ? [{ member, connectedAt: row.connectedAt.toISOString() }] : [];
      }),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.connectedAt, key: last.peerId })
          : null,
    };
  }

  /** Open requests of the viewer, received or sent. */
  async requests(
    viewerId: string,
    direction: ConnectionRequestDirection,
    query: CursorPageQuery,
  ): Promise<CursorPage<ConnectionRequest>> {
    const rows = await this.network.requests(viewerId, direction, this.clock.now(), {
      after: decodeKeyset(query.cursor),
      limit: query.limit + 1,
    });
    const page = rows.slice(0, query.limit);
    const cards = await this.members.cards(
      page.map((row) => (direction === 'sent' ? row.addresseeId : row.requesterId)),
    );
    const last = page.at(-1);
    return {
      items: page.flatMap((row) => {
        const member = cards.get(direction === 'sent' ? row.addresseeId : row.requesterId);
        return member ? [requestView(row, direction, member)] : [];
      }),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.createdAt, key: last.id })
          : null,
    };
  }

  /** Relation between the viewer and a member; a member who blocked the viewer is not found. */
  async relationship(viewerId: string, handle: string): Promise<Relationship> {
    const memberId = await this.members.require(handle);
    const self = memberId === viewerId;
    const blocks = self
      ? { byA: false, byB: false }
      : await this.network.blocksBetween(viewerId, memberId);
    if (blocks.byB) throw new DomainError('NETWORK_MEMBER_NOT_FOUND', 'Member not found');
    const cap = this.config.network.mutualConnectionsCap;
    const [connected, mutual, pending, following, followedBy, visibility] = await Promise.all([
      self ? false : this.network.areConnected(viewerId, memberId),
      self ? 0 : this.network.countMutualConnections(viewerId, memberId, cap),
      self ? null : this.network.pendingBetween(viewerId, memberId),
      self ? null : this.network.findFollow(viewerId, MEMBER_TARGET, memberId),
      self ? null : this.network.findFollow(memberId, MEMBER_TARGET, viewerId),
      this.profiles.visibilityOf(memberId),
    ]);
    const open = pending && pending.expiresAt > this.clock.now() ? pending : null;
    const listsVisible =
      visibility !== null &&
      canSeeNetworkLists(
        visibility.networkLists,
        self ? 'owner' : 'member',
        visibility.publicPageEnabled,
      );
    return {
      degree: degreeOf({ self, connected, mutualConnections: mutual }),
      mutualConnections: { count: mutual, capped: mutual >= cap },
      connection: connectionStateOf(viewerId, connected, open),
      requestId: open?.id ?? null,
      following: following !== null,
      followedBy: followedBy !== null,
      blocked: blocks.byA,
      counts: listsVisible
        ? {
            followers: await this.network.countFollowers(MEMBER_TARGET, memberId),
            connections: await this.network.countConnections(memberId),
          }
        : null,
    };
  }

  /**
   * Owner of the lists and the members to leave out. Hidden lists answer 403 to a member and
   * 404 to an anonymous reader; a member who blocked the reader is not found.
   */
  private async listAccess(
    reader: NetworkReader,
    handle: string,
  ): Promise<{ ownerId: string; excluded: string[] }> {
    const ownerId = await this.members.require(handle);
    const visibility = await this.profiles.visibilityOf(ownerId);
    if (!visibility) throw new DomainError('NETWORK_MEMBER_NOT_FOUND', 'Member not found');
    if (reader.viewerId === null) {
      if (!canSeeNetworkLists(visibility.networkLists, 'public', visibility.publicPageEnabled)) {
        throw new DomainError('NETWORK_MEMBER_NOT_FOUND', 'Member not found');
      }
      return { ownerId, excluded: [] };
    }
    const audience: ListAudience = reader.viewerId === ownerId ? 'owner' : 'member';
    if (audience === 'member') {
      const blocks = await this.network.blocksBetween(reader.viewerId, ownerId);
      if (blocks.byB) throw new DomainError('NETWORK_MEMBER_NOT_FOUND', 'Member not found');
    }
    if (!canSeeNetworkLists(visibility.networkLists, audience, visibility.publicPageEnabled)) {
      throw new DomainError('NETWORK_LIST_HIDDEN', 'This network list is hidden');
    }
    return { ownerId, excluded: await this.network.blockedIds(reader.viewerId) };
  }

  private async followerPage(
    targetType: string,
    targetId: string,
    excluded: readonly string[],
    query: CursorPageQuery,
  ): Promise<CursorPage<Follower>> {
    const rows = await this.network.followers(targetType, targetId, {
      after: decodeKeyset(query.cursor),
      limit: query.limit + 1,
      excludedUserIds: excluded,
    });
    const page = rows.slice(0, query.limit);
    const cards = await this.members.cards(page.map((row) => row.followerId));
    const last = page.at(-1);
    return {
      items: page.flatMap((row) => {
        const member = cards.get(row.followerId);
        return member ? [{ member, followedAt: row.createdAt.toISOString() }] : [];
      }),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.createdAt, key: last.followerId })
          : null,
    };
  }
}

import type { ConnectionRequestDirection, ConnectionRequestStatus } from '@pitchorium/contracts';
import type { KeysetPosition } from '../../../platform/kernel';
import type { ConnectionRequestRecord } from '../domain/connection-rules';
import type { FollowOrigin } from '../domain/network-events';

export interface FollowRecord {
  followerId: string;
  targetType: string;
  targetId: string;
  origin: FollowOrigin;
  createdAt: Date;
}

export interface ConnectionRecord {
  userId: string;
  peerId: string;
  connectedAt: Date;
}

export interface BlockRecord {
  blockerId: string;
  blockedId: string;
  createdAt: Date;
}

export interface ProfileViewRecord {
  viewedId: string;
  day: string;
  viewerId: string;
  viewedAt: Date;
  private: boolean;
}

/** A page request on a newest-first list: position of the last item seen, size, exclusions. */
export interface PageRequest {
  after: KeysetPosition | null;
  limit: number;
  /** Members left out of the page (blocks of the viewer). */
  excludedUserIds?: readonly string[];
}

export abstract class NetworkRepository {
  /** Transaction-scoped lock on a key (a pair of members, the requests of a member). */
  abstract lock(key: string): Promise<void>;

  /** False when the follow already existed. */
  abstract insertFollow(follow: FollowRecord): Promise<boolean>;
  abstract deleteFollow(followerId: string, targetType: string, targetId: string): Promise<boolean>;
  abstract findFollow(
    followerId: string,
    targetType: string,
    targetId: string,
  ): Promise<FollowRecord | null>;
  /** Member follows between two members, both directions. */
  abstract memberFollowsBetween(a: string, b: string): Promise<FollowRecord[]>;
  abstract followers(
    targetType: string,
    targetId: string,
    page: PageRequest,
  ): Promise<FollowRecord[]>;
  abstract following(
    followerId: string,
    targetType: string | undefined,
    page: PageRequest,
  ): Promise<FollowRecord[]>;
  abstract followedIds(followerId: string, targetType: string): Promise<string[]>;
  abstract countFollowers(targetType: string, targetId: string): Promise<number>;

  abstract insertConnection(a: string, b: string, at: Date): Promise<void>;
  /** Removes both directions; false when they were not connected. */
  abstract deleteConnection(a: string, b: string): Promise<boolean>;
  abstract areConnected(a: string, b: string): Promise<boolean>;
  abstract connections(userId: string, page: PageRequest): Promise<ConnectionRecord[]>;
  abstract connectionIds(userId: string): Promise<string[]>;
  abstract countConnections(userId: string): Promise<number>;
  /** Connections shared by two members, counted up to `cap`. */
  abstract countMutualConnections(a: string, b: string, cap: number): Promise<number>;

  abstract insertRequest(request: ConnectionRequestRecord): Promise<void>;
  abstract findRequest(id: string): Promise<ConnectionRequestRecord | null>;
  /** The pending request between two members, whatever its direction and expiry. */
  abstract pendingBetween(a: string, b: string): Promise<ConnectionRequestRecord | null>;
  abstract lastDeclined(requesterId: string, addresseeId: string): Promise<Date | null>;
  abstract countSentSince(requesterId: string, since: Date): Promise<number>;
  /** Changes the status of a pending request; false when it was no longer pending. */
  abstract closeRequest(id: string, status: ConnectionRequestStatus, at: Date): Promise<boolean>;
  abstract requests(
    userId: string,
    direction: ConnectionRequestDirection,
    openAt: Date,
    page: PageRequest,
  ): Promise<ConnectionRequestRecord[]>;
  /** Marks expired the pending requests past their expiry; returns how many. */
  abstract expirePending(now: Date, limit: number): Promise<number>;

  /** False when the block already existed. */
  abstract insertBlock(block: BlockRecord): Promise<boolean>;
  abstract deleteBlock(blockerId: string, blockedId: string): Promise<boolean>;
  abstract blocksBetween(a: string, b: string): Promise<{ byA: boolean; byB: boolean }>;
  /** Members a member blocked or was blocked by. */
  abstract blockedIds(userId: string): Promise<string[]>;
  abstract blocks(blockerId: string, page: PageRequest): Promise<BlockRecord[]>;

  abstract privateProfileViews(userId: string): Promise<boolean>;
  abstract setPrivateProfileViews(userId: string, value: boolean, at: Date): Promise<void>;
  /** Viewers among the given ones who chose private visits. */
  abstract privateViewers(userIds: readonly string[]): Promise<Set<string>>;

  /** Ignores the views already recorded for the same visitor, member and day. */
  abstract insertProfileViews(views: readonly ProfileViewRecord[]): Promise<number>;
  abstract countProfileViews(
    viewedId: string,
    fromDay: string,
    excludedUserIds: readonly string[],
  ): Promise<number>;
  abstract profileViews(
    viewedId: string,
    fromDay: string,
    page: {
      after: { day: string; viewerId: string } | null;
      limit: number;
      excludedUserIds: readonly string[];
    },
  ): Promise<ProfileViewRecord[]>;
  abstract purgeProfileViewsBefore(day: string): Promise<number>;
}

export interface BufferedProfileView {
  viewerId: string;
  viewedId: string;
  day: string;
  at: string;
}

/**
 * Port: buffer of profile views between the api read and the worker (ADR 0030). Deduplicates
 * by visitor, member and day; losing views (buffer down) is tolerated.
 */
export abstract class ProfileViewBuffer {
  abstract push(view: BufferedProfileView): Promise<void>;
  abstract drain(max: number): Promise<BufferedProfileView[]>;
}

export interface FollowTargetSummary {
  key: string;
  displayName: string;
  subtitle: string | null;
  imageUrl: string | null;
}

/**
 * A kind of followable target, registered by the module that owns it (members by network,
 * organizations by organizations, projects by projects). Validation goes through its facade.
 */
export interface FollowTargetType {
  readonly type: string;
  /** Identifier behind a public key; null when the target does not exist. */
  resolve(key: string): Promise<string | null>;
  describe(ids: readonly string[]): Promise<Map<string, FollowTargetSummary>>;
}

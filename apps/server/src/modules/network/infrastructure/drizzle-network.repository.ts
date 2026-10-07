import { Injectable } from '@nestjs/common';
import type { ConnectionRequestDirection, ConnectionRequestStatus } from '@pitchorium/contracts';
import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  lt,
  lte,
  notInArray,
  or,
  sql,
} from '@pitchorium/db/orm';
import {
  networkBlocks,
  networkConnectionRequests,
  networkConnections,
  networkFollows,
  networkProfileViews,
  networkSettings,
} from '@pitchorium/db/schemas/network';
import type { Column } from '@pitchorium/db/orm';
import { TransactionManager } from '../../../platform/database';
import type { ConnectionRequestRecord } from '../domain/connection-rules';
import type { FollowOrigin } from '../domain/network-events';
import {
  type BlockRecord,
  type ConnectionRecord,
  type FollowRecord,
  NetworkRepository,
  type PageRequest,
  type ProfileViewRecord,
  type ProfileViewsOfDay,
} from '../application/ports';

type FollowRow = typeof networkFollows.$inferSelect;
type RequestRow = typeof networkConnectionRequests.$inferSelect;

const toFollow = (row: FollowRow): FollowRecord => ({
  followerId: row.followerId,
  targetType: row.targetType,
  targetId: row.targetId,
  origin: row.origin as FollowOrigin,
  createdAt: row.createdAt,
});

const toRequest = (row: RequestRow): ConnectionRequestRecord => ({
  id: row.id,
  requesterId: row.requesterId,
  addresseeId: row.addresseeId,
  note: row.note,
  status: row.status as ConnectionRequestStatus,
  createdAt: row.createdAt,
  expiresAt: row.expiresAt,
  respondedAt: row.respondedAt,
});

const MEMBER = 'member';

@Injectable()
export class DrizzleNetworkRepository extends NetworkRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async lock(key: string): Promise<void> {
    await this.db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }

  async insertFollow(follow: FollowRecord): Promise<boolean> {
    const inserted = await this.db
      .insert(networkFollows)
      .values(follow)
      .onConflictDoNothing()
      .returning({ followerId: networkFollows.followerId });
    return inserted.length > 0;
  }

  async deleteFollow(followerId: string, targetType: string, targetId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(networkFollows)
      .where(
        and(
          eq(networkFollows.followerId, followerId),
          eq(networkFollows.targetType, targetType),
          eq(networkFollows.targetId, targetId),
        ),
      )
      .returning({ followerId: networkFollows.followerId });
    return deleted.length > 0;
  }

  async findFollow(
    followerId: string,
    targetType: string,
    targetId: string,
  ): Promise<FollowRecord | null> {
    const [row] = await this.db
      .select()
      .from(networkFollows)
      .where(
        and(
          eq(networkFollows.followerId, followerId),
          eq(networkFollows.targetType, targetType),
          eq(networkFollows.targetId, targetId),
        ),
      );
    return row ? toFollow(row) : null;
  }

  async memberFollowsBetween(a: string, b: string): Promise<FollowRecord[]> {
    const rows = await this.db
      .select()
      .from(networkFollows)
      .where(
        and(
          eq(networkFollows.targetType, MEMBER),
          or(
            and(eq(networkFollows.followerId, a), eq(networkFollows.targetId, b)),
            and(eq(networkFollows.followerId, b), eq(networkFollows.targetId, a)),
          ),
        ),
      );
    return rows.map(toFollow);
  }

  async followers(
    targetType: string,
    targetId: string,
    page: PageRequest,
  ): Promise<FollowRecord[]> {
    const rows = await this.db
      .select()
      .from(networkFollows)
      .where(
        and(
          eq(networkFollows.targetType, targetType),
          eq(networkFollows.targetId, targetId),
          page.after
            ? sql`(${networkFollows.createdAt}, ${networkFollows.followerId}) < (${page.after.at}, ${page.after.key}::uuid)`
            : undefined,
          excluding(networkFollows.followerId, page.excludedUserIds),
        ),
      )
      .orderBy(desc(networkFollows.createdAt), desc(networkFollows.followerId))
      .limit(page.limit);
    return rows.map(toFollow);
  }

  async following(
    followerId: string,
    targetType: string | undefined,
    page: PageRequest,
  ): Promise<FollowRecord[]> {
    const rows = await this.db
      .select()
      .from(networkFollows)
      .where(
        and(
          eq(networkFollows.followerId, followerId),
          targetType ? eq(networkFollows.targetType, targetType) : undefined,
          page.after
            ? sql`(${networkFollows.createdAt}, ${networkFollows.targetId}) < (${page.after.at}, ${page.after.key}::uuid)`
            : undefined,
          page.excludedUserIds && page.excludedUserIds.length > 0
            ? or(
                sql`${networkFollows.targetType} <> ${MEMBER}`,
                notInArray(networkFollows.targetId, [...page.excludedUserIds]),
              )
            : undefined,
        ),
      )
      .orderBy(desc(networkFollows.createdAt), desc(networkFollows.targetId))
      .limit(page.limit);
    return rows.map(toFollow);
  }

  async followedIds(followerId: string, targetType: string): Promise<string[]> {
    const rows = await this.db
      .select({ targetId: networkFollows.targetId })
      .from(networkFollows)
      .where(
        and(eq(networkFollows.followerId, followerId), eq(networkFollows.targetType, targetType)),
      );
    return rows.map((row) => row.targetId);
  }

  async followerIdsAfter(
    targetType: string,
    targetId: string,
    afterFollowerId: string | null,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.db
      .select({ followerId: networkFollows.followerId })
      .from(networkFollows)
      .where(
        and(
          eq(networkFollows.targetType, targetType),
          eq(networkFollows.targetId, targetId),
          afterFollowerId ? gt(networkFollows.followerId, afterFollowerId) : undefined,
        ),
      )
      .orderBy(networkFollows.followerId)
      .limit(limit);
    return rows.map((row) => row.followerId);
  }

  async countFollowers(targetType: string, targetId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(networkFollows)
      .where(and(eq(networkFollows.targetType, targetType), eq(networkFollows.targetId, targetId)));
    return row?.count ?? 0;
  }

  async insertConnection(a: string, b: string, at: Date): Promise<void> {
    await this.db
      .insert(networkConnections)
      .values([
        { userId: a, peerId: b, connectedAt: at },
        { userId: b, peerId: a, connectedAt: at },
      ])
      .onConflictDoNothing();
  }

  async deleteConnection(a: string, b: string): Promise<boolean> {
    const deleted = await this.db
      .delete(networkConnections)
      .where(
        or(
          and(eq(networkConnections.userId, a), eq(networkConnections.peerId, b)),
          and(eq(networkConnections.userId, b), eq(networkConnections.peerId, a)),
        ),
      )
      .returning({ userId: networkConnections.userId });
    return deleted.length > 0;
  }

  async areConnected(a: string, b: string): Promise<boolean> {
    const [row] = await this.db
      .select({ userId: networkConnections.userId })
      .from(networkConnections)
      .where(and(eq(networkConnections.userId, a), eq(networkConnections.peerId, b)));
    return row !== undefined;
  }

  async connections(userId: string, page: PageRequest): Promise<ConnectionRecord[]> {
    return this.db
      .select()
      .from(networkConnections)
      .where(
        and(
          eq(networkConnections.userId, userId),
          page.after
            ? sql`(${networkConnections.connectedAt}, ${networkConnections.peerId}) < (${page.after.at}, ${page.after.key}::uuid)`
            : undefined,
          excluding(networkConnections.peerId, page.excludedUserIds),
        ),
      )
      .orderBy(desc(networkConnections.connectedAt), desc(networkConnections.peerId))
      .limit(page.limit);
  }

  async connectionIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ peerId: networkConnections.peerId })
      .from(networkConnections)
      .where(eq(networkConnections.userId, userId));
    return rows.map((row) => row.peerId);
  }

  async countConnections(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(networkConnections)
      .where(eq(networkConnections.userId, userId));
    return row?.count ?? 0;
  }

  /** Intersection of the two connection lists through the primary key, stopped at `cap`. */
  async countMutualConnections(a: string, b: string, cap: number): Promise<number> {
    const result = await this.db.execute<{ count: number }>(sql`
      select count(*)::int as count from (
        select 1 from ${networkConnections} mine
        join ${networkConnections} theirs
          on theirs.peer_id = mine.peer_id and theirs.user_id = ${b}
        where mine.user_id = ${a}
        limit ${cap}
      ) mutual`);
    return result.rows[0]?.count ?? 0;
  }

  async insertRequest(request: ConnectionRequestRecord): Promise<void> {
    await this.db.insert(networkConnectionRequests).values(request);
  }

  async findRequest(id: string): Promise<ConnectionRequestRecord | null> {
    const [row] = await this.db
      .select()
      .from(networkConnectionRequests)
      .where(eq(networkConnectionRequests.id, id));
    return row ? toRequest(row) : null;
  }

  async pendingBetween(a: string, b: string): Promise<ConnectionRequestRecord | null> {
    const [row] = await this.db
      .select()
      .from(networkConnectionRequests)
      .where(
        and(
          eq(networkConnectionRequests.status, 'pending'),
          or(
            and(
              eq(networkConnectionRequests.requesterId, a),
              eq(networkConnectionRequests.addresseeId, b),
            ),
            and(
              eq(networkConnectionRequests.requesterId, b),
              eq(networkConnectionRequests.addresseeId, a),
            ),
          ),
        ),
      );
    return row ? toRequest(row) : null;
  }

  async lastDeclined(requesterId: string, addresseeId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ respondedAt: networkConnectionRequests.respondedAt })
      .from(networkConnectionRequests)
      .where(
        and(
          eq(networkConnectionRequests.requesterId, requesterId),
          eq(networkConnectionRequests.addresseeId, addresseeId),
          eq(networkConnectionRequests.status, 'declined'),
        ),
      )
      .orderBy(desc(networkConnectionRequests.respondedAt))
      .limit(1);
    return row?.respondedAt ?? null;
  }

  async countSentSince(requesterId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(networkConnectionRequests)
      .where(
        and(
          eq(networkConnectionRequests.requesterId, requesterId),
          gt(networkConnectionRequests.createdAt, since),
        ),
      );
    return row?.count ?? 0;
  }

  async closeRequest(id: string, status: ConnectionRequestStatus, at: Date): Promise<boolean> {
    const updated = await this.db
      .update(networkConnectionRequests)
      .set({ status, respondedAt: at })
      .where(
        and(eq(networkConnectionRequests.id, id), eq(networkConnectionRequests.status, 'pending')),
      )
      .returning({ id: networkConnectionRequests.id });
    return updated.length > 0;
  }

  async countPendingReceived(userId: string, openAt: Date): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(networkConnectionRequests)
      .where(
        and(
          eq(networkConnectionRequests.addresseeId, userId),
          eq(networkConnectionRequests.status, 'pending'),
          gt(networkConnectionRequests.expiresAt, openAt),
        ),
      );
    return row?.value ?? 0;
  }

  async requests(
    userId: string,
    direction: ConnectionRequestDirection,
    openAt: Date,
    page: PageRequest,
  ): Promise<ConnectionRequestRecord[]> {
    const owner =
      direction === 'received'
        ? networkConnectionRequests.addresseeId
        : networkConnectionRequests.requesterId;
    const rows = await this.db
      .select()
      .from(networkConnectionRequests)
      .where(
        and(
          eq(owner, userId),
          eq(networkConnectionRequests.status, 'pending'),
          gt(networkConnectionRequests.expiresAt, openAt),
          page.after
            ? sql`(${networkConnectionRequests.createdAt}, ${networkConnectionRequests.id}) < (${page.after.at}, ${page.after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(networkConnectionRequests.createdAt), desc(networkConnectionRequests.id))
      .limit(page.limit);
    return rows.map(toRequest);
  }

  async expirePending(now: Date, limit: number): Promise<number> {
    const due = this.db
      .select({ id: networkConnectionRequests.id })
      .from(networkConnectionRequests)
      .where(
        and(
          eq(networkConnectionRequests.status, 'pending'),
          lte(networkConnectionRequests.expiresAt, now),
        ),
      )
      .limit(limit);
    const expired = await this.db
      .update(networkConnectionRequests)
      .set({ status: 'expired', respondedAt: now })
      .where(
        and(
          inArray(networkConnectionRequests.id, due),
          eq(networkConnectionRequests.status, 'pending'),
        ),
      )
      .returning({ id: networkConnectionRequests.id });
    return expired.length;
  }

  async insertBlock(block: BlockRecord): Promise<boolean> {
    const inserted = await this.db
      .insert(networkBlocks)
      .values(block)
      .onConflictDoNothing()
      .returning({ blockerId: networkBlocks.blockerId });
    return inserted.length > 0;
  }

  async deleteBlock(blockerId: string, blockedId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(networkBlocks)
      .where(and(eq(networkBlocks.blockerId, blockerId), eq(networkBlocks.blockedId, blockedId)))
      .returning({ blockerId: networkBlocks.blockerId });
    return deleted.length > 0;
  }

  async blocksBetween(a: string, b: string): Promise<{ byA: boolean; byB: boolean }> {
    const rows = await this.db
      .select({ blockerId: networkBlocks.blockerId })
      .from(networkBlocks)
      .where(
        or(
          and(eq(networkBlocks.blockerId, a), eq(networkBlocks.blockedId, b)),
          and(eq(networkBlocks.blockerId, b), eq(networkBlocks.blockedId, a)),
        ),
      );
    return {
      byA: rows.some((row) => row.blockerId === a),
      byB: rows.some((row) => row.blockerId === b),
    };
  }

  async blockedIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ blockerId: networkBlocks.blockerId, blockedId: networkBlocks.blockedId })
      .from(networkBlocks)
      .where(or(eq(networkBlocks.blockerId, userId), eq(networkBlocks.blockedId, userId)));
    return [
      ...new Set(rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId))),
    ];
  }

  async blocks(blockerId: string, page: PageRequest): Promise<BlockRecord[]> {
    return this.db
      .select()
      .from(networkBlocks)
      .where(
        and(
          eq(networkBlocks.blockerId, blockerId),
          page.after
            ? sql`(${networkBlocks.createdAt}, ${networkBlocks.blockedId}) < (${page.after.at}, ${page.after.key}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(networkBlocks.createdAt), desc(networkBlocks.blockedId))
      .limit(page.limit);
  }

  async privateProfileViews(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ value: networkSettings.privateProfileViews })
      .from(networkSettings)
      .where(eq(networkSettings.userId, userId));
    return row?.value ?? false;
  }

  async setPrivateProfileViews(userId: string, value: boolean, at: Date): Promise<void> {
    await this.db
      .insert(networkSettings)
      .values({ userId, privateProfileViews: value, updatedAt: at })
      .onConflictDoUpdate({
        target: networkSettings.userId,
        set: { privateProfileViews: value, updatedAt: at },
      });
  }

  async privateViewers(userIds: readonly string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const rows = await this.db
      .select({ userId: networkSettings.userId })
      .from(networkSettings)
      .where(
        and(
          inArray(networkSettings.userId, [...new Set(userIds)]),
          eq(networkSettings.privateProfileViews, true),
        ),
      );
    return new Set(rows.map((row) => row.userId));
  }

  async insertProfileViews(views: readonly ProfileViewRecord[]): Promise<number> {
    if (views.length === 0) return 0;
    const inserted = await this.db
      .insert(networkProfileViews)
      .values([...views])
      .onConflictDoNothing()
      .returning({ viewerId: networkProfileViews.viewerId });
    return inserted.length;
  }

  async profileViewsOfDay(
    day: string,
    afterViewedId: string | null,
    limit: number,
  ): Promise<ProfileViewsOfDay[]> {
    const rows = await this.db
      .select({
        viewedId: networkProfileViews.viewedId,
        total: count(),
        visible: sql<
          string[]
        >`coalesce(array_agg(${networkProfileViews.viewerId} order by ${networkProfileViews.viewedAt} desc) filter (where not ${networkProfileViews.private}), '{}')`,
      })
      .from(networkProfileViews)
      .where(
        and(
          sql`${networkProfileViews.day} = ${day}::date`,
          afterViewedId ? gt(networkProfileViews.viewedId, afterViewedId) : undefined,
        ),
      )
      .groupBy(networkProfileViews.viewedId)
      .orderBy(networkProfileViews.viewedId)
      .limit(limit);
    return rows.map((row) => ({
      viewedId: row.viewedId,
      total: row.total,
      visibleViewerIds: row.visible,
    }));
  }

  async countProfileViews(
    viewedId: string,
    fromDay: string,
    excludedUserIds: readonly string[],
  ): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(networkProfileViews)
      .where(
        and(
          eq(networkProfileViews.viewedId, viewedId),
          sql`${networkProfileViews.day} >= ${fromDay}`,
          excluding(networkProfileViews.viewerId, excludedUserIds),
        ),
      );
    return row?.count ?? 0;
  }

  async profileViews(
    viewedId: string,
    fromDay: string,
    page: {
      after: { day: string; viewerId: string } | null;
      limit: number;
      excludedUserIds: readonly string[];
    },
  ): Promise<ProfileViewRecord[]> {
    return this.db
      .select()
      .from(networkProfileViews)
      .where(
        and(
          eq(networkProfileViews.viewedId, viewedId),
          sql`${networkProfileViews.day} >= ${fromDay}`,
          page.after
            ? sql`(${networkProfileViews.day}, ${networkProfileViews.viewerId}) < (${page.after.day}::date, ${page.after.viewerId}::uuid)`
            : undefined,
          excluding(networkProfileViews.viewerId, page.excludedUserIds),
        ),
      )
      .orderBy(desc(networkProfileViews.day), desc(networkProfileViews.viewerId))
      .limit(page.limit);
  }

  async purgeProfileViewsBefore(day: string): Promise<number> {
    const deleted = await this.db
      .delete(networkProfileViews)
      .where(lt(networkProfileViews.day, day))
      .returning({ viewerId: networkProfileViews.viewerId });
    return deleted.length;
  }
}

function excluding(column: Column, ids: readonly string[] | undefined) {
  return ids && ids.length > 0 ? notInArray(column, [...ids]) : undefined;
}

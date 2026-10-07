import { Inject, Injectable } from '@nestjs/common';
import type { ConnectionRequest, CreateConnectionRequest } from '@pitchorium/contracts';
import { API_CONFIG, type ApiConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import {
  assertAnswerable,
  assertWithdrawable,
  type ConnectionRequestRecord,
  decideRequest,
  expiryOf,
  WEEK_MS,
} from '../domain/connection-rules';
import {
  ConnectionAccepted,
  ConnectionDeclined,
  ConnectionRemoved,
  ConnectionRequested,
  ConnectionWithdrawn,
  FollowCreated,
  FollowRemoved,
} from '../domain/network-events';
import { MEMBER_TARGET } from './follow-target.registry';
import { MemberDirectory } from './member-directory';
import { NetworkEventsRecorder } from './network-events.recorder';
import { NetworkRepository } from './ports';

/** Lock key shared by every write between two members, whatever the direction. */
export const pairLock = (a: string, b: string) =>
  `network:pair:${a < b ? `${a}:${b}` : `${b}:${a}`}`;

/** Connection requests and connections (§10.2, ADR 0028). */
@Injectable()
export class ConnectionsService {
  constructor(
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    private readonly network: NetworkRepository,
    private readonly members: MemberDirectory,
    private readonly events: NetworkEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** Sends a request, or accepts the pending request of the addressee if there is one. */
  async request(userId: string, body: CreateConnectionRequest): Promise<ConnectionRequest> {
    const addresseeId = await this.members.require(body.handle);
    const record = await this.transactions.run(async () => {
      await this.network.lock(pairLock(userId, addresseeId));
      await this.network.lock(`network:requests:${userId}`);
      const now = this.clock.now();
      let pending = await this.network.pendingBetween(userId, addresseeId);
      if (pending && pending.expiresAt <= now) {
        await this.network.closeRequest(pending.id, 'expired', now);
        pending = null;
      }
      const [connected, blocks, lastDeclinedAt, sentLastWeek] = await Promise.all([
        this.network.areConnected(userId, addresseeId),
        this.network.blocksBetween(userId, addresseeId),
        this.network.lastDeclined(userId, addresseeId),
        this.network.countSentSince(userId, new Date(now.getTime() - WEEK_MS)),
      ]);
      const decision = decideRequest(
        {
          requesterId: userId,
          addresseeId,
          connected,
          pending,
          blockedByRequester: blocks.byA,
          blockedByAddressee: blocks.byB,
          lastDeclinedAt,
          sentLastWeek,
          now,
        },
        {
          requestsPerWeek: this.config.network.connectionRequestsPerWeek,
          declineCooldownMs: this.config.network.declineCooldownMs,
        },
      );
      if (decision.kind === 'accept_reverse' && pending) {
        return this.acceptInTransaction(pending, now);
      }
      const created: ConnectionRequestRecord = {
        id: this.ids.next(),
        requesterId: userId,
        addresseeId,
        note: body.note ?? null,
        status: 'pending',
        createdAt: now,
        expiresAt: expiryOf(now, this.config.network.requestTtlMs),
        respondedAt: null,
      };
      await this.network.insertRequest(created);
      await this.events.record(ConnectionRequested, created.id, {
        requesterId: userId,
        addresseeId,
      });
      return created;
    });
    return this.view(userId, record);
  }

  async accept(userId: string, requestId: string): Promise<ConnectionRequest> {
    const record = await this.transactions.run(async () => {
      const found = await this.network.findRequest(requestId);
      if (found) await this.network.lock(pairLock(found.requesterId, found.addresseeId));
      const request = assertAnswerable(
        await this.network.findRequest(requestId),
        userId,
        this.clock.now(),
      );
      return this.acceptInTransaction(request, this.clock.now());
    });
    return this.view(userId, record);
  }

  async decline(userId: string, requestId: string): Promise<void> {
    await this.transactions.run(async () => {
      const now = this.clock.now();
      const request = assertAnswerable(await this.network.findRequest(requestId), userId, now);
      if (!(await this.network.closeRequest(request.id, 'declined', now))) throw notPending();
      await this.events.record(ConnectionDeclined, request.id, {
        requesterId: request.requesterId,
        addresseeId: request.addresseeId,
      });
    });
  }

  async withdraw(userId: string, requestId: string): Promise<void> {
    await this.transactions.run(async () => {
      const now = this.clock.now();
      const request = assertWithdrawable(await this.network.findRequest(requestId), userId, now);
      if (!(await this.network.closeRequest(request.id, 'withdrawn', now))) throw notPending();
      await this.events.record(ConnectionWithdrawn, request.id, {
        requesterId: request.requesterId,
        addresseeId: request.addresseeId,
      });
    });
  }

  /** Removes a connection and the follows it created; follows chosen by hand remain. */
  async remove(userId: string, handle: string): Promise<void> {
    const peerId = await this.members.require(handle);
    await this.transactions.run(async () => {
      await this.network.lock(pairLock(userId, peerId));
      if (!(await this.network.deleteConnection(userId, peerId))) {
        throw new DomainError('NETWORK_NOT_CONNECTED', 'Members are not connected');
      }
      for (const follow of await this.network.memberFollowsBetween(userId, peerId)) {
        if (follow.origin !== 'connection') continue;
        await this.network.deleteFollow(follow.followerId, MEMBER_TARGET, follow.targetId);
        await this.events.record(FollowRemoved, follow.followerId, {
          targetType: MEMBER_TARGET,
          targetId: follow.targetId,
          reason: 'connection_removed',
        });
      }
      await this.events.record(ConnectionRemoved, userId, { peerId, reason: 'removed' });
    });
  }

  /** Connects both members and creates the mutual follows (manual follows are kept). */
  private async acceptInTransaction(
    request: ConnectionRequestRecord,
    now: Date,
  ): Promise<ConnectionRequestRecord> {
    if (!(await this.network.closeRequest(request.id, 'accepted', now))) throw notPending();
    await this.network.insertConnection(request.requesterId, request.addresseeId, now);
    for (const [followerId, targetId] of [
      [request.requesterId, request.addresseeId],
      [request.addresseeId, request.requesterId],
    ] as const) {
      const created = await this.network.insertFollow({
        followerId,
        targetType: MEMBER_TARGET,
        targetId,
        origin: 'connection',
        createdAt: now,
      });
      if (created) {
        await this.events.record(FollowCreated, followerId, {
          targetType: MEMBER_TARGET,
          targetId,
          origin: 'connection',
        });
      }
    }
    await this.events.record(ConnectionAccepted, request.id, {
      requesterId: request.requesterId,
      addresseeId: request.addresseeId,
    });
    return { ...request, status: 'accepted', respondedAt: now };
  }

  async view(viewerId: string, request: ConnectionRequestRecord): Promise<ConnectionRequest> {
    const sent = request.requesterId === viewerId;
    const otherId = sent ? request.addresseeId : request.requesterId;
    const card = (await this.members.cards([otherId])).get(otherId);
    if (!card) throw new DomainError('NETWORK_MEMBER_NOT_FOUND', 'Member not found');
    return requestView(request, sent ? 'sent' : 'received', card);
  }
}

export function requestView(
  request: ConnectionRequestRecord,
  direction: ConnectionRequest['direction'],
  member: ConnectionRequest['member'],
): ConnectionRequest {
  return {
    id: request.id,
    direction,
    member,
    note: request.note,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    expiresAt: request.expiresAt.toISOString(),
    respondedAt: request.respondedAt?.toISOString() ?? null,
  };
}

const notPending = () =>
  new DomainError('NETWORK_REQUEST_NOT_PENDING', 'Connection request is not pending');

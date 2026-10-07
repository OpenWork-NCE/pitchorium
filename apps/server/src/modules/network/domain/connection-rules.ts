import type { ConnectionRequestStatus } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';

export interface ConnectionRequestRecord {
  id: string;
  requesterId: string;
  addresseeId: string;
  note: string | null;
  status: ConnectionRequestStatus;
  createdAt: Date;
  expiresAt: Date;
  respondedAt: Date | null;
}

/** Anti-abuse limits, provisional and configurable (docs/open-questions.md). */
export interface ConnectionLimits {
  requestsPerWeek: number;
  declineCooldownMs: number;
}

/** What is known about two members when one asks the other to connect. */
export interface RequestContext {
  requesterId: string;
  addresseeId: string;
  connected: boolean;
  /** The open pending request between them, whatever its direction. */
  pending: Pick<ConnectionRequestRecord, 'id' | 'requesterId'> | null;
  /** The requester blocked the addressee. */
  blockedByRequester: boolean;
  /** The addressee blocked the requester. */
  blockedByAddressee: boolean;
  /** Last time the addressee declined a request of the requester. */
  lastDeclinedAt: Date | null;
  /** Requests sent by the requester over the last seven days. */
  sentLastWeek: number;
  now: Date;
}

export type RequestDecision =
  | { kind: 'create' }
  /** The addressee had already asked: the new request accepts theirs. */
  | { kind: 'accept_reverse'; requestId: string };

export const WEEK_MS = 7 * 86_400_000;

/**
 * Checks a connection request. A member blocked by the addressee learns nothing (404, as for an
 * unknown member). The weekly limit and the cooldown after a decline do not apply when the
 * request answers a pending request of the addressee.
 */
export function decideRequest(context: RequestContext, limits: ConnectionLimits): RequestDecision {
  if (context.requesterId === context.addresseeId) {
    throw new DomainError('NETWORK_SELF_RELATION', 'A member cannot connect with themselves');
  }
  if (context.blockedByAddressee) {
    throw new DomainError('NETWORK_MEMBER_NOT_FOUND', 'Member not found');
  }
  if (context.blockedByRequester) {
    throw new DomainError('NETWORK_MEMBER_BLOCKED', 'The requester blocked this member');
  }
  if (context.connected) {
    throw new DomainError('NETWORK_ALREADY_CONNECTED', 'Members are already connected');
  }
  if (context.pending) {
    if (context.pending.requesterId === context.addresseeId) {
      return { kind: 'accept_reverse', requestId: context.pending.id };
    }
    throw new DomainError('NETWORK_REQUEST_ALREADY_PENDING', 'A request is already pending');
  }
  if (
    context.lastDeclinedAt &&
    context.now.getTime() - context.lastDeclinedAt.getTime() < limits.declineCooldownMs
  ) {
    throw new DomainError('NETWORK_REQUEST_COOLDOWN', 'The member declined recently');
  }
  if (context.sentLastWeek >= limits.requestsPerWeek) {
    throw new DomainError('NETWORK_WEEKLY_REQUEST_LIMIT', 'Weekly request limit reached');
  }
  return { kind: 'create' };
}

export function expiryOf(createdAt: Date, ttlMs: number): Date {
  return new Date(createdAt.getTime() + ttlMs);
}

/** Pending and not expired; an expired request is closed lazily or by the scheduled task. */
export function isOpen(request: ConnectionRequestRecord, now: Date): boolean {
  return request.status === 'pending' && request.expiresAt.getTime() > now.getTime();
}

/** Only the addressee answers; the request of someone else is reported as missing. */
export function assertAnswerable(
  request: ConnectionRequestRecord | null,
  userId: string,
  now: Date,
): ConnectionRequestRecord {
  if (!request || request.addresseeId !== userId) {
    throw new DomainError('NETWORK_REQUEST_NOT_FOUND', 'Connection request not found');
  }
  if (!isOpen(request, now)) {
    throw new DomainError('NETWORK_REQUEST_NOT_PENDING', 'Connection request is not pending');
  }
  return request;
}

/** Only the requester withdraws. */
export function assertWithdrawable(
  request: ConnectionRequestRecord | null,
  userId: string,
  now: Date,
): ConnectionRequestRecord {
  if (!request || request.requesterId !== userId) {
    throw new DomainError('NETWORK_REQUEST_NOT_FOUND', 'Connection request not found');
  }
  if (!isOpen(request, now)) {
    throw new DomainError('NETWORK_REQUEST_NOT_PENDING', 'Connection request is not pending');
  }
  return request;
}

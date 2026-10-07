import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../platform/kernel';
import { blockEffects } from './block-effects';
import {
  assertAnswerable,
  assertWithdrawable,
  type ConnectionRequestRecord,
  decideRequest,
  expiryOf,
  isOpen,
  type RequestContext,
} from './connection-rules';
import { anonymizedSector, dayOf, windowStart } from './profile-views';
import { canSeeNetworkLists, connectionStateOf, degreeOf } from './relationship';

const DAY = 86_400_000;
const NOW = new Date('2026-10-07T12:00:00Z');
const LIMITS = { requestsPerWeek: 3, declineCooldownMs: 21 * DAY };

const context = (overrides: Partial<RequestContext> = {}): RequestContext => ({
  requesterId: 'ama',
  addresseeId: 'kofi',
  connected: false,
  pending: null,
  blockedByRequester: false,
  blockedByAddressee: false,
  lastDeclinedAt: null,
  sentLastWeek: 0,
  now: NOW,
  ...overrides,
});

const codeOf = (work: () => unknown) => {
  try {
    work();
    return 'none';
  } catch (error) {
    return error instanceof DomainError ? error.code : 'unexpected';
  }
};

const request = (overrides: Partial<ConnectionRequestRecord> = {}): ConnectionRequestRecord => ({
  id: 'request-1',
  requesterId: 'ama',
  addresseeId: 'kofi',
  note: null,
  status: 'pending',
  createdAt: NOW,
  expiresAt: expiryOf(NOW, 30 * DAY),
  respondedAt: null,
  ...overrides,
});

describe('connection requests', () => {
  it('creates a request between two unrelated members', () => {
    expect(decideRequest(context(), LIMITS)).toEqual({ kind: 'create' });
  });

  it('enforces the weekly limit', () => {
    expect(decideRequest(context({ sentLastWeek: 2 }), LIMITS)).toEqual({ kind: 'create' });
    expect(codeOf(() => decideRequest(context({ sentLastWeek: 3 }), LIMITS))).toBe(
      'NETWORK_WEEKLY_REQUEST_LIMIT',
    );
  });

  it('waits for the cooldown after a decline', () => {
    const declined = (daysAgo: number) =>
      context({ lastDeclinedAt: new Date(NOW.getTime() - daysAgo * DAY) });
    expect(codeOf(() => decideRequest(declined(20), LIMITS))).toBe('NETWORK_REQUEST_COOLDOWN');
    expect(decideRequest(declined(21), LIMITS)).toEqual({ kind: 'create' });
  });

  it('accepts the pending request of the addressee instead of creating a second one', () => {
    const reverse = context({ pending: { id: 'request-0', requesterId: 'kofi' }, sentLastWeek: 9 });
    expect(decideRequest(reverse, LIMITS)).toEqual({
      kind: 'accept_reverse',
      requestId: 'request-0',
    });
    const same = context({ pending: { id: 'request-0', requesterId: 'ama' } });
    expect(codeOf(() => decideRequest(same, LIMITS))).toBe('NETWORK_REQUEST_ALREADY_PENDING');
  });

  it('refuses self, connected and blocked members, hiding a block by the addressee', () => {
    expect(codeOf(() => decideRequest(context({ addresseeId: 'ama' }), LIMITS))).toBe(
      'NETWORK_SELF_RELATION',
    );
    expect(codeOf(() => decideRequest(context({ connected: true }), LIMITS))).toBe(
      'NETWORK_ALREADY_CONNECTED',
    );
    expect(codeOf(() => decideRequest(context({ blockedByAddressee: true }), LIMITS))).toBe(
      'NETWORK_MEMBER_NOT_FOUND',
    );
    expect(codeOf(() => decideRequest(context({ blockedByRequester: true }), LIMITS))).toBe(
      'NETWORK_MEMBER_BLOCKED',
    );
  });

  it('expires a pending request after its lifetime', () => {
    const open = request();
    expect(isOpen(open, new Date(NOW.getTime() + 29 * DAY))).toBe(true);
    expect(isOpen(open, new Date(NOW.getTime() + 30 * DAY))).toBe(false);
    expect(isOpen(request({ status: 'declined' }), NOW)).toBe(false);
    const later = new Date(NOW.getTime() + 31 * DAY);
    expect(codeOf(() => assertAnswerable(open, 'kofi', later))).toBe('NETWORK_REQUEST_NOT_PENDING');
  });

  it('lets only the addressee answer and only the requester withdraw', () => {
    expect(assertAnswerable(request(), 'kofi', NOW).id).toBe('request-1');
    expect(codeOf(() => assertAnswerable(request(), 'ama', NOW))).toBe('NETWORK_REQUEST_NOT_FOUND');
    expect(codeOf(() => assertAnswerable(null, 'kofi', NOW))).toBe('NETWORK_REQUEST_NOT_FOUND');
    expect(assertWithdrawable(request(), 'ama', NOW).id).toBe('request-1');
    expect(codeOf(() => assertWithdrawable(request(), 'kofi', NOW))).toBe(
      'NETWORK_REQUEST_NOT_FOUND',
    );
    expect(codeOf(() => assertWithdrawable(request({ status: 'accepted' }), 'ama', NOW))).toBe(
      'NETWORK_REQUEST_NOT_PENDING',
    );
  });
});

describe('blocking', () => {
  it('removes the connection, the follows in both directions and the pending requests', () => {
    const effects = blockEffects({
      connected: true,
      follows: [
        { followerId: 'ama', targetId: 'kofi' },
        { followerId: 'kofi', targetId: 'ama' },
      ],
      pendingRequestIds: ['request-1'],
    });
    expect(effects).toEqual({
      removeConnection: true,
      removedFollows: [
        { followerId: 'ama', targetId: 'kofi', reason: 'blocked' },
        { followerId: 'kofi', targetId: 'ama', reason: 'blocked' },
      ],
      cancelledRequestIds: ['request-1'],
    });
    expect(blockEffects({ connected: false, follows: [], pendingRequestIds: [] })).toEqual({
      removeConnection: false,
      removedFollows: [],
      cancelledRequestIds: [],
    });
  });
});

describe('relationship', () => {
  it('computes the degree up to the second one', () => {
    expect(degreeOf({ self: true, connected: false, mutualConnections: 0 })).toBe('self');
    expect(degreeOf({ self: false, connected: true, mutualConnections: 4 })).toBe('first');
    expect(degreeOf({ self: false, connected: false, mutualConnections: 1 })).toBe('second');
    expect(degreeOf({ self: false, connected: false, mutualConnections: 0 })).toBe(
      'out_of_network',
    );
  });

  it('tells the state of the connection from the viewer side', () => {
    expect(connectionStateOf('ama', true, null)).toBe('connected');
    expect(connectionStateOf('ama', false, { requesterId: 'ama' })).toBe('request_sent');
    expect(connectionStateOf('ama', false, { requesterId: 'kofi' })).toBe('request_received');
    expect(connectionStateOf('ama', false, null)).toBe('none');
  });

  it('applies the visibility of network lists to each audience', () => {
    expect(canSeeNetworkLists('private', 'owner', false)).toBe(true);
    expect(canSeeNetworkLists('private', 'member', true)).toBe(false);
    expect(canSeeNetworkLists('members', 'member', false)).toBe(true);
    expect(canSeeNetworkLists('members', 'public', true)).toBe(false);
    expect(canSeeNetworkLists('public', 'public', false)).toBe(false);
    expect(canSeeNetworkLists('public', 'public', true)).toBe(true);
  });
});

describe('profile views', () => {
  it('counts days in UTC and anonymizes with the first visible sector', () => {
    expect(dayOf(new Date('2026-10-07T23:59:59Z'))).toBe('2026-10-07');
    expect(windowStart(NOW, 7)).toBe('2026-10-01');
    expect(anonymizedSector(['agriculture', 'energy'])).toBe('agriculture');
    expect(anonymizedSector(undefined)).toBeNull();
  });
});

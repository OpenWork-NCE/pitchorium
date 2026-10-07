import { NOTIFICATION_TYPES } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { groupKeyOf, MAX_ACTORS, mergeActor } from './aggregation';
import { isDigestDue, localTime } from './digest';
import { NOTIFICATION_DEFINITIONS } from './notification-types';
import { assertEditable, resolveChannels, wantsUnreadCopy } from './preferences';

describe('notification registry', () => {
  it('defines every type of the contracts', () => {
    expect(Object.keys(NOTIFICATION_DEFINITIONS).sort()).toEqual([...NOTIFICATION_TYPES].sort());
  });
});

describe('grouping', () => {
  const post = { type: 'post' as const, key: 'p1' };

  it('groups by target, by type, or not at all', () => {
    expect(groupKeyOf('reaction', 'target', post, 'e1')).toBe(
      groupKeyOf('reaction', 'target', post, 'e2'),
    );
    expect(groupKeyOf('reaction', 'target', post, 'e1')).not.toBe(
      groupKeyOf('reaction', 'target', { type: 'post', key: 'p2' }, 'e1'),
    );
    expect(groupKeyOf('new_follower', 'type', post, 'e1')).toBe('new_follower');
    expect(groupKeyOf('kyc_decided', 'none', post, 'e1')).not.toBe(
      groupKeyOf('kyc_decided', 'none', post, 'e2'),
    );
  });

  it('puts the latest actor first and counts each actor once', () => {
    const first = mergeActor([], 0, 'amina');
    const second = mergeActor(first.actorIds, first.actorCount, 'kofi');
    const again = mergeActor(second.actorIds, second.actorCount, 'amina');
    expect(again).toEqual({ actorIds: ['amina', 'kofi'], actorCount: 2 });
    let many = { actorIds: [] as string[], actorCount: 0 };
    for (let i = 0; i < 13; i += 1) many = mergeActor(many.actorIds, many.actorCount, `m${i}`);
    expect(many.actorIds).toHaveLength(MAX_ACTORS);
    expect(many.actorCount).toBe(13);
  });
});

describe('preferences', () => {
  const none = new Map();

  it('uses the defaults of the type unless the member chose', () => {
    expect(resolveChannels('comment', none, 'off')).toEqual({ inApp: true, email: 'immediate' });
    expect(resolveChannels('reaction', none, 'off')).toEqual({ inApp: true, email: 'off' });
    expect(resolveChannels('comment', new Map([['email', false]]), 'off').email).toBe('off');
    expect(
      resolveChannels(
        'reaction',
        new Map([
          ['in_app', false],
          ['email', true],
        ]),
        'off',
      ),
    ).toEqual({
      inApp: false,
      email: 'immediate',
    });
  });

  it('gathers emails in the chosen digest, never emails low priority at once', () => {
    expect(resolveChannels('comment', none, 'daily').email).toBe('digest');
    expect(resolveChannels('followed_post', new Map([['email', true]]), 'off').email).toBe('off');
    expect(resolveChannels('followed_post', new Map([['email', true]]), 'weekly').email).toBe(
      'digest',
    );
  });

  it('keeps transactional types on, at once, whatever the choices', () => {
    const refused = new Map([
      ['in_app', false],
      ['email', false],
    ] as const);
    expect(resolveChannels('kyc_decided', refused, 'weekly')).toEqual({
      inApp: true,
      email: 'immediate',
    });
    expect(resolveChannels('security_alert', refused, 'off')).toEqual({
      inApp: true,
      email: 'off',
    });
    expect(() => assertEditable('contribution_refunded')).toThrow('transactional');
    expect(() => assertEditable('reaction')).not.toThrow();
  });

  it('sends the copy of unread messages only once turned on', () => {
    expect(wantsUnreadCopy(none)).toBe(false);
    expect(wantsUnreadCopy(new Map([['email', true]]))).toBe(true);
    expect(resolveChannels('message', new Map([['email', true]]), 'off').email).toBe('off');
  });
});

describe('digests by time zone', () => {
  // 2026-10-12 is a Monday; 06:30 UTC is 07:30 in Lagos and 08:30 in Paris (CEST).
  const now = new Date('2026-10-12T06:30:00Z');

  it('reads the local date, hour and weekday', () => {
    expect(localTime(now, 'Europe/Paris')).toEqual({ date: '2026-10-12', hour: 8, weekday: 1 });
    expect(localTime(now, 'America/Port-au-Prince').date).toBe('2026-10-12');
    expect(localTime(new Date('2026-10-12T03:00:00Z'), 'America/Port-au-Prince').date).toBe(
      '2026-10-11',
    );
  });

  it('is due from the local digest hour, once per local day or Monday', () => {
    const due = (timeZone: string, digest: 'daily' | 'weekly', lastDigestAt: Date | null = null) =>
      isDigestDue({ now, timeZone, digest, lastDigestAt, hour: 8 });
    expect(due('Europe/Paris', 'daily')).toBe(true);
    expect(due('Africa/Lagos', 'daily')).toBe(false);
    expect(due('Europe/Paris', 'weekly')).toBe(true);
    expect(due('Europe/Paris', 'daily', new Date('2026-10-12T06:05:00Z'))).toBe(false);
    expect(due('Europe/Paris', 'daily', new Date('2026-10-11T06:05:00Z'))).toBe(true);
    expect(
      isDigestDue({
        now: new Date('2026-10-13T06:30:00Z'),
        timeZone: 'Europe/Paris',
        digest: 'weekly',
        lastDigestAt: null,
        hour: 8,
      }),
    ).toBe(false);
  });
});

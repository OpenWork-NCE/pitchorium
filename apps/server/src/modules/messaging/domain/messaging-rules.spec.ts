import { describe, expect, it } from 'vitest';
import {
  assertEditable,
  decideSend,
  decideStart,
  directKeyOf,
  requestStateFor,
} from './conversation';
import { answer, assertIntroducible, type IntroductionRecord } from './introduction';

describe('conversation eligibility', () => {
  const start = (degree: 'first' | 'second' | 'out_of_network', policy: string, verified = true) =>
    decideStart({
      degree,
      senderEmailVerified: verified,
      recipientPolicy: policy as 'connections_only',
    });

  it('lets connected members write freely, even without a verified email', () => {
    expect(start('first', 'connections_only', false)).toEqual({ outcome: 'active' });
  });

  it('turns a first message out of network into a request, by the policy of the recipient', () => {
    expect(start('second', 'connections_and_second_degree')).toEqual({ outcome: 'request' });
    expect(start('out_of_network', 'connections_and_second_degree')).toMatchObject({
      outcome: 'refused',
    });
    expect(start('second', 'connections_only')).toMatchObject({ outcome: 'refused' });
    expect(start('out_of_network', 'verified_members')).toEqual({ outcome: 'request' });
  });

  it('requires a verified email out of network', () => {
    expect(start('second', 'verified_members', false)).toEqual({ outcome: 'email_required' });
  });

  it('keys a direct conversation by the pair, whatever the order', () => {
    expect(directKeyOf('b', 'a')).toBe(directKeyOf('a', 'b'));
  });
});

describe('message request', () => {
  const live = { leftAt: null };
  const request = { status: 'request' as const, requestedBy: 'a', requestRecipientId: 'b' };
  const declined = { ...request, status: 'declined' as const };

  it('blocks the sender until the answer, and stays silent about a decline', () => {
    expect(decideSend(request, live, 'a', false)).toEqual({
      outcome: 'refused',
      code: 'MESSAGING_REQUEST_PENDING',
    });
    expect(decideSend(declined, live, 'a', false)).toEqual(decideSend(request, live, 'a', false));
    expect(requestStateFor(request, 'a')).toBe('sent');
    expect(requestStateFor(declined, 'a')).toBe('sent');
    expect(requestStateFor(request, 'b')).toBe('received');
    expect(requestStateFor(declined, 'b')).toBe('none');
  });

  it('is accepted by a reply of the recipient or once the members are connected', () => {
    expect(decideSend(request, live, 'b', false)).toEqual({
      outcome: 'accept_and_send',
      reason: 'answer',
    });
    expect(decideSend(request, live, 'a', true)).toEqual({
      outcome: 'accept_and_send',
      reason: 'connected',
    });
    expect(
      decideSend({ status: 'active', requestedBy: 'a' }, { leftAt: new Date() }, 'a', true),
    ).toMatchObject({ code: 'MESSAGING_CANNOT_SEND' });
  });
});

describe('edit window', () => {
  const sent = new Date('2026-10-08T10:00:00Z');
  const message = { senderId: 'a', createdAt: sent, deletedAt: null, kind: 'text' as const };
  const at = (minutes: number) => new Date(sent.getTime() + minutes * 60_000);

  it('lets the sender edit during the window only', () => {
    expect(() => assertEditable(message, 'a', at(15), 15 * 60_000)).not.toThrow();
    expect(() => assertEditable(message, 'a', at(16), 15 * 60_000)).toThrow(
      'The edit window is closed',
    );
    expect(() => assertEditable(message, 'b', at(1), 15 * 60_000)).toThrow(
      'Only the sender may edit the message',
    );
    expect(() => assertEditable({ ...message, deletedAt: at(1) }, 'a', at(2), 15 * 60_000)).toThrow(
      'Message deleted',
    );
  });
});

describe('introduction', () => {
  const pending: IntroductionRecord = {
    id: 'i',
    introducerId: 'a',
    firstId: 'b',
    secondId: 'c',
    note: 'Vous devriez vous parler.',
    firstAnswer: 'pending',
    secondAnswer: 'pending',
    status: 'pending',
    conversationId: null,
    createdAt: new Date(),
    decidedAt: null,
  };

  it('needs two other members both connected to the introducer', () => {
    const base = { introducerId: 'a', firstId: 'b', secondId: 'c' };
    expect(() =>
      assertIntroducible({ ...base, connectedToFirst: true, connectedToSecond: false }),
    ).toThrow('The introducer must be connected to both members');
    expect(() =>
      assertIntroducible({
        ...base,
        secondId: 'b',
        connectedToFirst: true,
        connectedToSecond: true,
      }),
    ).toThrow('Two other distinct members');
  });

  it('completes on two acceptances, ends on one decline, and is answered once', () => {
    const first = answer(pending, 'first', true);
    expect(first.outcome).toBe('waiting');
    expect(answer({ ...pending, ...first }, 'second', true).outcome).toBe('completed');
    expect(answer({ ...pending, ...first }, 'second', false).outcome).toBe('declined');
    expect(() => answer({ ...pending, ...first }, 'first', false)).toThrow(
      'The introduction was already answered',
    );
  });
});

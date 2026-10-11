import { describe, expect, it } from 'vitest';
import { engageVerb, engagementActions } from './engagement-actions';

const roles = { responder: false, expert: false, beneficiary: false };

describe('engagementActions', () => {
  it('lets the author answer a request, and who asked withdraw it', () => {
    expect(
      engagementActions({ ...roles, status: 'requested', responder: true, beneficiary: true }),
    ).toEqual(['accept', 'decline']);
    expect(engagementActions({ ...roles, status: 'requested', expert: true })).toEqual([
      'withdraw',
    ]);
  });

  it('lets the expert complete a mission in progress, and either party cancel it', () => {
    expect(engagementActions({ ...roles, status: 'accepted', expert: true })).toEqual([
      'complete',
      'cancel',
    ]);
    expect(engagementActions({ ...roles, status: 'accepted', beneficiary: true })).toEqual([
      'cancel',
    ]);
  });

  it('offers nothing on an ended engagement or to anyone else', () => {
    for (const status of ['declined', 'completed', 'canceled'] as const) {
      expect(engagementActions({ ...roles, status, expert: true })).toEqual([]);
    }
    expect(engagementActions({ ...roles, status: 'accepted' })).toEqual([]);
  });

  it('applies to a request and solicits an offer', () => {
    expect(engageVerb('request')).toBe('apply');
    expect(engageVerb('offer')).toBe('solicit');
  });
});

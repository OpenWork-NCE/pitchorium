import { describe, expect, it } from 'vitest';
import {
  appealableUntil,
  assertAppealable,
  assertAppealReview,
  assertDecisionAllowed,
  reportOutcomeOf,
  requiresAdmin,
} from './decisions';
import { FUNDING_FRAUD_PRIORITY, priorityOf } from './priority';
import { isActive, isOverAndUnannounced } from './suspension';
import type { AppealRecord, DecisionRecord, SuspensionRecord } from './trust';

const NOW = new Date('2026-10-08T12:00:00Z');
const DAY = 86_400_000;

describe('priority of a case', () => {
  it('puts fraud on a project in funding first, whatever the other cases', () => {
    const fraud = priorityOf({
      targetType: 'project',
      origin: 'report',
      reasons: ['fraud'],
      reportCount: 1,
      fundingActive: true,
    });
    const illegal = priorityOf({
      targetType: 'post',
      origin: 'report',
      reasons: ['illegal_content'],
      reportCount: 30,
      fundingActive: false,
    });
    expect(fraud).toEqual({
      priority: FUNDING_FRAUD_PRIORITY,
      reasons: ['funding_fraud', 'reason:fraud'],
    });
    expect(fraud.priority).toBeGreaterThan(illegal.priority);
    // The same fraud on a closed project is an ordinary fraud.
    expect(
      priorityOf({
        targetType: 'project',
        origin: 'report',
        reasons: ['fraud'],
        reportCount: 1,
        fundingActive: false,
      }).priority,
    ).toBe(70);
  });

  it('weighs the strongest reason and adds a capped bonus per extra report', () => {
    expect(
      priorityOf({
        targetType: 'post',
        origin: 'report',
        reasons: ['spam', 'harassment'],
        reportCount: 3,
        fundingActive: false,
      }),
    ).toEqual({ priority: 70, reasons: ['reason:harassment', 'reports:3'] });
    expect(
      priorityOf({
        targetType: 'post',
        origin: 'report',
        reasons: ['spam'],
        reportCount: 500,
        fundingActive: false,
      }).priority,
    ).toBe(20 + 50);
  });

  it('gives a signal its own weight, below the serious reasons', () => {
    expect(
      priorityOf({
        targetType: 'profile',
        origin: 'signal',
        reasons: [],
        reportCount: 0,
        fundingActive: false,
      }),
    ).toEqual({ priority: 30, reasons: ['signal'] });
  });
});

describe('decisions', () => {
  const context = {
    targetType: 'post' as const,
    subjectId: 'user-2',
    actorIsAdmin: false,
    moderatorMaxSuspensionDays: 30,
  };

  it('hides or removes contents only, freezes projects only', () => {
    expect(() =>
      assertDecisionAllowed({ kind: 'hide', suspensionDays: null }, context),
    ).not.toThrow();
    expect(() =>
      assertDecisionAllowed(
        { kind: 'remove', suspensionDays: null },
        { ...context, targetType: 'profile' },
      ),
    ).toThrow(expect.objectContaining({ code: 'TRUST_DECISION_NOT_APPLICABLE' }));
    expect(() =>
      assertDecisionAllowed(
        { kind: 'freeze_project', suspensionDays: null },
        { ...context, actorIsAdmin: true },
      ),
    ).toThrow(expect.objectContaining({ code: 'TRUST_DECISION_NOT_APPLICABLE' }));
    expect(() =>
      assertDecisionAllowed(
        { kind: 'warn', suspensionDays: null },
        { ...context, subjectId: null },
      ),
    ).toThrow(expect.objectContaining({ code: 'TRUST_DECISION_NOT_APPLICABLE' }));
  });

  it('lets a moderator suspend up to the configured length, an admin beyond and for good', () => {
    expect(() =>
      assertDecisionAllowed({ kind: 'suspend', suspensionDays: 30 }, context),
    ).not.toThrow();
    for (const suspensionDays of [31, null]) {
      expect(() => assertDecisionAllowed({ kind: 'suspend', suspensionDays }, context)).toThrow(
        expect.objectContaining({ code: 'TRUST_ADMIN_REQUIRED' }),
      );
      expect(() =>
        assertDecisionAllowed(
          { kind: 'suspend', suspensionDays },
          { ...context, actorIsAdmin: true },
        ),
      ).not.toThrow();
    }
    expect(requiresAdmin({ kind: 'freeze_project', suspensionDays: null }, 30)).toBe(true);
    expect(() =>
      assertDecisionAllowed(
        { kind: 'freeze_project', suspensionDays: null },
        { ...context, targetType: 'project' },
      ),
    ).toThrow(expect.objectContaining({ code: 'TRUST_ADMIN_REQUIRED' }));
    expect(() => assertDecisionAllowed({ kind: 'warn', suspensionDays: 3 }, context)).toThrow(
      expect.objectContaining({ code: 'TRUST_DECISION_NOT_APPLICABLE' }),
    );
  });

  it('tells reporters whether an action was taken', () => {
    expect(reportOutcomeOf('dismiss')).toBe('no_action');
    expect(reportOutcomeOf('remove')).toBe('action_taken');
  });
});

describe('appeals', () => {
  const decision: DecisionRecord = {
    id: 'd-1',
    caseId: 'c-1',
    targetType: 'post',
    targetId: 'p-1',
    subjectId: 'user-2',
    kind: 'remove',
    reason: 'spam',
    statement: 'Publication commerciale répétée.',
    ground: 'terms',
    groundReference: null,
    automatedDetection: false,
    suspensionEndsAt: null,
    decidedBy: 'mod-1',
    decidedAt: NOW,
    appealableUntil: appealableUntil('remove', NOW, 183 * DAY),
    revertedAt: null,
  };
  const appeal: AppealRecord = {
    id: 'a-1',
    decisionId: 'd-1',
    appellantId: 'user-2',
    statement: 'Ce n’était pas commercial.',
    status: 'pending',
    reviewerId: null,
    outcomeStatement: null,
    createdAt: NOW,
    resolvedAt: null,
  };

  it('opens one appeal within the window, none on a dismissal', () => {
    expect(() => assertAppealable(decision, null, NOW)).not.toThrow();
    expect(() => assertAppealable(decision, appeal, NOW)).toThrow(
      expect.objectContaining({ code: 'TRUST_APPEAL_EXISTS' }),
    );
    expect(() => assertAppealable(decision, null, new Date(NOW.getTime() + 184 * DAY))).toThrow(
      expect.objectContaining({ code: 'TRUST_NOT_APPEALABLE' }),
    );
    expect(appealableUntil('dismiss', NOW, DAY)).toBeNull();
  });

  it('is reviewed once, by someone other than the author of the decision', () => {
    expect(() => assertAppealReview(appeal, decision, 'mod-1')).toThrow(
      expect.objectContaining({ code: 'TRUST_SAME_MODERATOR' }),
    );
    expect(() => assertAppealReview(appeal, decision, 'mod-2')).not.toThrow();
    expect(() => assertAppealReview({ ...appeal, status: 'upheld' }, decision, 'mod-2')).toThrow(
      expect.objectContaining({ code: 'TRUST_APPEAL_RESOLVED' }),
    );
  });
});

describe('suspensions', () => {
  const suspension: SuspensionRecord = {
    id: 's-1',
    userId: 'user-2',
    decisionId: 'd-1',
    startsAt: NOW,
    endsAt: new Date(NOW.getTime() + 7 * DAY),
    liftedAt: null,
    liftedBy: null,
    liftStatement: null,
    endedAt: null,
  };

  it('is active from its start to its end, unless lifted; permanent without end', () => {
    expect(isActive(suspension, NOW)).toBe(true);
    expect(isActive(suspension, new Date(NOW.getTime() + 7 * DAY))).toBe(false);
    expect(isActive({ ...suspension, liftedAt: NOW }, NOW)).toBe(false);
    expect(isActive({ ...suspension, endsAt: null }, new Date(NOW.getTime() + 3650 * DAY))).toBe(
      true,
    );
  });

  it('is announced as ended once', () => {
    const later = new Date(NOW.getTime() + 8 * DAY);
    expect(isOverAndUnannounced(suspension, later)).toBe(true);
    expect(isOverAndUnannounced({ ...suspension, endedAt: later }, later)).toBe(false);
    expect(isOverAndUnannounced(suspension, NOW)).toBe(false);
  });
});

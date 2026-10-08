import { describe, expect, it } from 'vitest';
import {
  answerDueAt,
  cancelable,
  erasureDate,
  erasureDue,
  type ErasureRecord,
  exportAllowed,
  type ExportRecord,
  reminderDue,
} from './privacy';

const NOW = new Date('2026-10-08T12:00:00Z');
const DAY = 86_400_000;

const erasure = (patch: Partial<ErasureRecord> = {}): ErasureRecord => ({
  id: 'e-1',
  userId: 'user-1',
  status: 'scheduled',
  pseudonym: null,
  contact: null,
  progress: [],
  blockedBy: null,
  residues: null,
  requestedAt: NOW,
  scheduledFor: erasureDate(NOW, 30),
  remindedAt: null,
  canceledAt: null,
  startedAt: null,
  completedAt: null,
  ...patch,
});

describe('privacy rules', () => {
  it('limits the exports to one per interval, unless the last one failed', () => {
    const latest: ExportRecord = {
      id: 'x-1',
      userId: 'user-1',
      status: 'ready',
      storageKey: 'k',
      sizeBytes: 1,
      error: null,
      requestedAt: NOW,
      completedAt: NOW,
      expiresAt: NOW,
    };
    expect(exportAllowed(null, NOW, DAY)).toBe(true);
    expect(exportAllowed(latest, new Date(NOW.getTime() + DAY - 1), DAY)).toBe(false);
    expect(exportAllowed(latest, new Date(NOW.getTime() + DAY), DAY)).toBe(true);
    expect(exportAllowed({ ...latest, status: 'failed' }, NOW, DAY)).toBe(true);
  });

  it('erases after the grace period, reminds once before, resumes an interrupted run', () => {
    const scheduled = erasure();
    expect(scheduled.scheduledFor.toISOString()).toBe('2026-11-07T12:00:00.000Z');
    expect(erasureDue(scheduled, new Date(NOW.getTime() + 29 * DAY))).toBe(false);
    expect(erasureDue(scheduled, scheduled.scheduledFor)).toBe(true);
    expect(erasureDue(erasure({ status: 'running' }), NOW)).toBe(true);
    expect(erasureDue(erasure({ status: 'canceled' }), scheduled.scheduledFor)).toBe(false);
    expect(erasureDue(erasure({ status: 'blocked' }), scheduled.scheduledFor)).toBe(true);
    expect(reminderDue(scheduled, new Date(NOW.getTime() + 22 * DAY), 7)).toBe(false);
    expect(reminderDue(scheduled, new Date(NOW.getTime() + 23 * DAY), 7)).toBe(true);
    expect(reminderDue(erasure({ remindedAt: NOW }), new Date(NOW.getTime() + 29 * DAY), 7)).toBe(
      false,
    );
  });

  it('cancels a scheduled or blocked erasure only, answers a request within a month', () => {
    expect(cancelable(erasure())).toBe(true);
    expect(cancelable(erasure({ status: 'blocked' }))).toBe(true);
    expect(cancelable(erasure({ status: 'running' }))).toBe(false);
    expect(answerDueAt(NOW).toISOString()).toBe('2026-11-07T12:00:00.000Z');
  });
});

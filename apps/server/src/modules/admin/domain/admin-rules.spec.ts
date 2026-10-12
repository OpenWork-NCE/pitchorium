import { describe, expect, it } from 'vitest';
import { auditCsv, csvField } from './audit-csv';
import { highlightPositions } from './highlights';

describe('order of the highlights', () => {
  it('numbers each type from 1, the latest featured first', () => {
    const at = (day: number) => new Date(Date.UTC(2026, 9, day));
    expect(
      highlightPositions([
        { targetType: 'project', targetId: 'p-old', featuredAt: at(1), label: null },
        { targetType: 'post', targetId: 'a', featuredAt: at(2), label: null },
        { targetType: 'project', targetId: 'p-new', featuredAt: at(5), label: null },
      ]).map((entry) => [entry.targetType, entry.targetId, entry.position]),
    ).toEqual([
      ['post', 'a', 1],
      ['project', 'p-new', 1],
      ['project', 'p-old', 2],
    ]);
  });
});

describe('export of the audit log', () => {
  it('writes RFC 4180 with the metadata as JSON', () => {
    const csv = auditCsv([
      {
        id: '0192f4a0-8000-7000-8000-000000000001',
        actorType: 'user',
        actorId: '0192f4a0-8000-7000-8000-000000000002',
        action: 'payments.refund-requested',
        targetType: 'contribution',
        targetId: 'c-1',
        metadata: { reason: 'Demande, « urgente »' },
        requestId: null,
        occurredAt: new Date('2026-10-10T09:00:00.000Z'),
      },
    ]);
    expect(csv.split('\r\n')).toEqual([
      'occurred_at,actor_type,actor_id,action,target_type,target_id,request_id,metadata,id',
      '2026-10-10T09:00:00.000Z,user,0192f4a0-8000-7000-8000-000000000002,payments.refund-requested,contribution,c-1,,"{""reason"":""Demande, « urgente »""}",0192f4a0-8000-7000-8000-000000000001',
      '',
    ]);
  });

  it('never lets a spreadsheet read a field as a formula', () => {
    expect(csvField('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvField('-1')).toBe("'-1");
    expect(csvField('plain')).toBe('plain');
  });
});

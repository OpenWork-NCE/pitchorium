import { describe, expect, it } from 'vitest';
import { auditFiltersOf, auditQueryOf } from './audit-query';

describe('audit filters', () => {
  it('keeps the known filters of the address, trimmed, and well formed days only', () => {
    expect(
      auditFiltersOf({
        action: ' payments.refund-requested ',
        targetType: '',
        from: '2026-10-01',
        to: '01/10/2026',
        other: 'x',
      }),
    ).toEqual({ action: 'payments.refund-requested', from: '2026-10-01' });
  });

  it('turns days into the instants of the api, the last day included', () => {
    expect(auditQueryOf({ actorId: 'u', from: '2026-10-01', to: '2026-10-12' })).toEqual({
      actorId: 'u',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-12T23:59:59.999Z',
    });
  });
});

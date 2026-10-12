import { APPEAL_STATEMENT_MAX_LENGTH, REPORT_DETAILS_MAX_LENGTH } from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { TRUST_LIMITS } from './limits';

describe('limits of the trust feature', () => {
  it('equal the limits of the contracts', () => {
    expect(TRUST_LIMITS).toEqual({
      reportDetails: REPORT_DETAILS_MAX_LENGTH,
      appealStatement: APPEAL_STATEMENT_MAX_LENGTH,
    });
  });
});

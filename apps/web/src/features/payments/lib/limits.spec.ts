import {
  DECISION_REASON_MAX_LENGTH,
  KYC_DOCUMENTS_MAX,
  OFFLINE_CONTRIBUTION_CURRENCIES,
  OFFLINE_DESCRIPTION_MAX_LENGTH,
  OFFLINE_PROOFS_MAX,
  TIME_ENTRY_DESCRIPTION_MAX_LENGTH,
  TIME_ENTRY_MAX_MINUTES,
} from '@pitchorium/contracts';
import { describe, expect, it } from 'vitest';
import { OFFLINE_CURRENCIES, PAYMENT_LIMITS } from './limits';

describe('PAYMENT_LIMITS', () => {
  it('equals the limits of the contracts', () => {
    expect(PAYMENT_LIMITS).toEqual({
      offlineDescription: OFFLINE_DESCRIPTION_MAX_LENGTH,
      offlineProofs: OFFLINE_PROOFS_MAX,
      kycDocuments: KYC_DOCUMENTS_MAX,
      decisionReason: DECISION_REASON_MAX_LENGTH,
      timeEntryDescription: TIME_ENTRY_DESCRIPTION_MAX_LENGTH,
      timeEntryMaxMinutes: TIME_ENTRY_MAX_MINUTES,
    });
    expect(OFFLINE_CURRENCIES).toEqual(OFFLINE_CONTRIBUTION_CURRENCIES);
  });
});

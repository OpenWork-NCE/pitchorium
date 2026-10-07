import { v7 as randomUUID } from 'uuid';
import { expect } from 'vitest';
import type { ContributionRecord } from '../../src/modules/payments/domain/contribution';
import {
  callProvider,
  type ExactJson,
  field,
} from '../../src/modules/payments/infrastructure/provider-http';

/** Asserts the field exists with the JSON type the adapter reads (numbers stay their text). */
export function expectShape(
  value: ExactJson | undefined,
  shape: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array' | 'nullable'>,
  where: string,
): void {
  for (const [path, kind] of Object.entries(shape)) {
    const found = field(value, ...path.split('.'));
    const actual =
      found === undefined
        ? 'missing'
        : found === null
          ? 'null'
          : Array.isArray(found)
            ? 'array'
            : typeof found === 'string' && /^-?\d+(\.\d+)?$/.test(found)
              ? 'number'
              : typeof found;
    if (kind === 'nullable') {
      expect(actual, `${where}: ${path}`).not.toBe('missing');
    } else if (kind === 'number') {
      expect(actual, `${where}: ${path}`).toBe('number');
    } else {
      expect(actual, `${where}: ${path}`).toBe(kind);
    }
  }
}

/** A raw call, to read the exact answer the adapter would get. */
export async function raw(
  provider: string,
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: ExactJson }> {
  return callProvider(provider, url, init);
}

/** The fields of a contribution the adapters read; amounts and states are irrelevant here. */
export function contributionRecord(
  patch: Partial<ContributionRecord> & Pick<ContributionRecord, 'provider' | 'currency'>,
): ContributionRecord {
  const now = new Date();
  return {
    id: randomUUID(),
    projectId: randomUUID(),
    contributorId: randomUUID(),
    organizationId: null,
    holderId: randomUUID(),
    kind: 'donation',
    status: 'pending_payment',
    method: 'card',
    country: null,
    providerAccountId: '',
    providerSessionId: null,
    providerPaymentId: null,
    paymentUrl: null,
    amountMinor: 0n,
    eurMinor: 0n,
    rateUnitsPerEur: '1',
    rateSource: 'identity',
    rateAt: now,
    commissionMinor: 0n,
    commissionRateBps: 500,
    commissionVersion: 'test',
    providerFeeMinor: null,
    refundedMinor: 0n,
    refundedEurMinor: 0n,
    commissionRefundedMinor: 0n,
    lostMinor: 0n,
    lostEurMinor: 0n,
    rewardId: null,
    rewardState: 'none',
    publicDisplay: false,
    anonymous: false,
    expiresAt: new Date(now.getTime() + 3_600_000),
    createdAt: now,
    updatedAt: now,
    succeededAt: null,
    endedAt: null,
    ...patch,
  };
}

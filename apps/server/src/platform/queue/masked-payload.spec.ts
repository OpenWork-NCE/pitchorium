import { describe, expect, it } from 'vitest';
import { maskFailedReason, maskJobData, REDACTED } from './masked-payload';

describe('payload of a failed job shown in the console', () => {
  it('keeps the structure, identifiers, dates, numbers and codes', () => {
    expect(
      maskJobData({
        eventId: '0192f4a0-8000-7000-8000-000000000001',
        type: 'payments.contribution.succeeded.v1',
        occurredAt: '2026-10-10T09:00:00.000Z',
        attempt: 3,
        retried: false,
        amountMinor: 5000,
        nested: { status: 'pending', ids: ['0192f4a0-8000-7000-8000-000000000002'] },
      }),
    ).toEqual({
      eventId: '0192f4a0-8000-7000-8000-000000000001',
      type: 'payments.contribution.succeeded.v1',
      occurredAt: '2026-10-10T09:00:00.000Z',
      attempt: 3,
      retried: false,
      amountMinor: 5000,
      nested: { status: 'pending', ids: ['0192f4a0-8000-7000-8000-000000000002'] },
    });
  });

  it('never shows a personal or secret value, under any key or at any depth', () => {
    expect(
      maskJobData({
        email: 'awa@example.com',
        displayName: 'Awa Diallo',
        payload: {
          recipient: { phone: '+221770000000', mobileNumber: '770000000' },
          body: 'Bonjour Awa',
          downloadUrl: 'https://storage.example/export.zip?X-Amz-Signature=abc',
          token: 'abc123',
          bankAccount: { iban: 'FR7630006000011234567890189' },
        },
        free: 'Une phrase libre avec des espaces',
        quoted: 'kofi@example.com',
      }),
    ).toEqual({
      email: REDACTED,
      displayName: REDACTED,
      payload: {
        recipient: { phone: REDACTED, mobileNumber: REDACTED },
        body: REDACTED,
        downloadUrl: REDACTED,
        token: REDACTED,
        bankAccount: REDACTED,
      },
      free: REDACTED,
      quoted: REDACTED,
    });
  });

  it('bounds the depth and the length of the lists', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 1 } } } } } } };
    expect(JSON.stringify(maskJobData(deep))).toContain(REDACTED);
    expect(maskJobData(Array.from({ length: 50 }, (_, index) => index))).toHaveLength(20);
  });

  it('removes the addresses an error message quotes', () => {
    expect(
      maskFailedReason('Mail to awa@example.com refused by https://api.resend.com/emails?key=1'),
    ).toBe(`Mail to ${REDACTED} refused by ${REDACTED}`);
    expect(maskFailedReason(null)).toBeNull();
  });
});

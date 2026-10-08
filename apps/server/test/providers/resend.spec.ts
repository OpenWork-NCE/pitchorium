import { describe, expect, it } from 'vitest';
import { ResendMailer } from '../../src/platform/mailer/resend-mailer';

const KEY = process.env['RESEND_TEST_API_KEY'] ?? '';
/** Sender every Resend account may use without a verified domain. */
const FROM = 'Pitchorium <onboarding@resend.dev>';

/**
 * Batch endpoint of Resend through the mailer adapter, with the test addresses of the Resend
 * documentation (resend.com/docs/dashboard/emails/send-test-emails): nothing reaches a real
 * mailbox and the reputation of the account is not affected.
 */
describe.skipIf(!KEY)('Resend sandbox', () => {
  it('sends a batch and returns one identifier per email, in order', async () => {
    const mailer = new ResendMailer(KEY, FROM);
    const receipts = await mailer.sendMany(
      ['delivered@resend.dev', 'bounced@resend.dev', 'complained@resend.dev'].map((to) => ({
        to,
        subject: `Pitchorium provider test (${to})`,
        html: '<p>Pitchorium provider test</p>',
        text: 'Pitchorium provider test',
        headers: { 'List-Unsubscribe': '<https://example.com/unsubscribe>' },
      })),
    );
    expect(receipts).toHaveLength(3);
    for (const receipt of receipts) expect(receipt.messageId).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Set(receipts.map((receipt) => receipt.messageId)).size).toBe(3);
  });
});

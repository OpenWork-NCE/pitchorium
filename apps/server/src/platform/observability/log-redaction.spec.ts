import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { LOG_REDACT_CENSOR, LOG_REDACT_PATHS } from './log-redaction';

function capture(): { logger: pino.Logger; output: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      chunks.push(chunk.toString());
      done();
    },
  });
  const logger = pino(
    { redact: { paths: [...LOG_REDACT_PATHS], censor: LOG_REDACT_CENSOR } },
    stream,
  );
  return { logger, output: () => chunks.join('') };
}

describe('log redaction', () => {
  it('masks credentials, signatures and personal fields', () => {
    const { logger, output } = capture();
    logger.info({
      req: {
        method: 'POST',
        url: '/v1/payments/webhooks/stripe',
        headers: {
          authorization: 'Bearer secret-bearer',
          cookie: 'pitchorium.session_token=secret-session',
          'stripe-signature': 't=1,v1=secret-signature',
          'verif-hash': 'secret-hash',
          'svix-signature': 'v1,secret-svix',
        },
      },
      res: { statusCode: 200, headers: { 'set-cookie': 'pitchorium.session_token=secret-cookie' } },
      user: { email: 'aissatou.ba@demo.pitchorium.test', password: 'secret-password' },
      provider: {
        apiKey: 'secret-key',
        token: 'secret-token',
        iban: 'FR7630006000011234567890189',
      },
    });
    const line = output();
    for (const secret of [
      'secret-bearer',
      'secret-session',
      'secret-signature',
      'secret-hash',
      'secret-svix',
      'secret-cookie',
      'aissatou.ba@demo',
      'secret-password',
      'secret-key',
      'secret-token',
      'FR7630006000',
    ]) {
      expect(line).not.toContain(secret);
    }
    expect(line).toContain(LOG_REDACT_CENSOR);
    expect(line).toContain('/v1/payments/webhooks/stripe');
  });
});

import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, it } from 'vitest';
import {
  CLIENT_ADDRESS_HEADER,
  CLIENT_ADDRESS_MAX_AGE_MS,
  signClientAddress,
} from '../../src/platform/http/client-address';
import { createApiTestApp } from './support/api-app';

const SECRET = 'integration-tests-client-address-secret';
const LIMIT = 3;

/**
 * Rate limiting of the visitors of the web app (ADR 0115): the web server calls the api from one
 * address on behalf of every visitor and relays each visitor's address in a signed header. The
 * proxy in front of the api is simulated (TRUST_PROXY_HOPS=1): `X-Forwarded-For` is the address
 * of the web server, a fresh one per test so that no other test shares its counter.
 */
describe('rate limiting of relayed visitors', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    ({ app } = await createApiTestApp([], {
      RATE_LIMIT_MAX: String(LIMIT),
      TRUST_PROXY_HOPS: '1',
      WEB_CLIENT_ADDRESS_SECRET: SECRET,
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  const call = (server: string, relayed?: string) => {
    const call = request(app.getHttpServer()).get('/v1/locales').set('X-Forwarded-For', server);
    return relayed ? call.set(CLIENT_ADDRESS_HEADER, relayed) : call;
  };

  it('limits two visitors behind the same web server separately, by a valid header', async () => {
    const server = '198.51.100.10';
    for (let index = 0; index < LIMIT; index += 1) {
      await call(server, signClientAddress('203.0.113.1', SECRET, Date.now())).expect(200);
    }
    await call(server, signClientAddress('203.0.113.1', SECRET, Date.now())).expect(429);
    // Another visitor of the same server, and the server itself, keep their own counters.
    await call(server, signClientAddress('203.0.113.2', SECRET, Date.now())).expect(200);
    await call(server).expect(200);
  });

  it('counts a forged header on the address of the web server', async () => {
    const server = '198.51.100.11';
    for (let index = 0; index < LIMIT; index += 1) {
      const forged = signClientAddress(
        `203.0.113.${10 + index}`,
        'not-the-shared-secret-at-all',
        Date.now(),
      );
      await call(server, forged).expect(200);
    }
    await call(server).expect(429);
    // The claimed addresses were never counted.
    await call('198.51.100.12', signClientAddress('203.0.113.10', SECRET, Date.now())).expect(200);
  });

  it('counts an expired header on the address of the web server', async () => {
    const server = '198.51.100.13';
    const expired = Date.now() - CLIENT_ADDRESS_MAX_AGE_MS - 1_000;
    for (let index = 0; index < LIMIT; index += 1) {
      await call(server, signClientAddress(`203.0.113.${20 + index}`, SECRET, expired)).expect(200);
    }
    await call(server).expect(429);
  });

  it('counts an altered header on the address of the web server', async () => {
    const server = '198.51.100.14';
    const header = signClientAddress('203.0.113.30', SECRET, Date.now());
    for (let index = 0; index < LIMIT; index += 1) {
      await call(server, header.replace('203.0.113.30', `203.0.113.${31 + index}`)).expect(200);
    }
    await call(server).expect(429);
  });
});

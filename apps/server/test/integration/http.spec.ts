import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiTestApp } from './support/api-app';
import type { FakeObjectStorage } from './support/fake-object-storage';
import { TestItemsController } from './support/test-items.controller';

describe('HTTP', () => {
  let app: NestExpressApplication;
  let storage: FakeObjectStorage;

  beforeAll(async () => {
    ({ app, storage } = await createApiTestApp([TestItemsController]));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('health', () => {
    it('reports liveness without checking dependencies', async () => {
      const response = await request(app.getHttpServer()).get('/v1/health/live').expect(200);
      expect(response.body).toEqual({ status: 'ok', checks: {} });
    });

    it('reports readiness of Postgres, Redis and storage', async () => {
      const response = await request(app.getHttpServer()).get('/v1/health/ready').expect(200);
      expect(response.body).toMatchObject({
        status: 'ok',
        checks: { postgres: { status: 'up' }, redis: { status: 'up' }, storage: { status: 'up' } },
      });
    });

    it('answers 503 without details when a dependency is down', async () => {
      storage.healthy = false;
      try {
        const response = await request(app.getHttpServer()).get('/v1/health/ready').expect(503);
        expect(response.body).toMatchObject({
          status: 'error',
          checks: { storage: { status: 'down' } },
        });
        expect(JSON.stringify(response.body)).not.toContain('unreachable');
      } finally {
        storage.healthy = true;
      }
    });
  });

  describe('RFC 9457 errors', () => {
    it('answers an unknown route with a problem document and the request id', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/does-not-exist')
        .expect(404)
        .expect('content-type', /application\/problem\+json/);

      expect(response.body).toEqual({
        type: 'urn:pitchorium:problem:not-found',
        title: 'Resource not found',
        status: 404,
        code: 'NOT_FOUND',
        instance: '/v1/does-not-exist',
        requestId: response.headers['x-request-id'],
      });
    });

    it('propagates a well-formed incoming X-Request-Id', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/does-not-exist')
        .set('X-Request-Id', 'edge-abc.123')
        .expect(404);
      expect(response.headers['x-request-id']).toBe('edge-abc.123');
      expect(response.body.requestId).toBe('edge-abc.123');
    });

    it('lists validation issues as JSON pointers', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/test-items')
        .set('Idempotency-Key', 'validation-1')
        .send({ name: '', quantity: 1.5 })
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED', status: 400 });
      expect(response.body.errors).toEqual([
        { pointer: '/name', code: 'too_small' },
        { pointer: '/quantity', code: 'invalid_type' },
      ]);
    });

    it('rejects malformed JSON as a bad request', async () => {
      const response = await request(app.getHttpServer())
        .post('/v1/test-items')
        .set('content-type', 'application/json')
        .send('{"name":')
        .expect(400);
      expect(response.body).toMatchObject({ code: 'BAD_REQUEST' });
      expect(response.body.requestId).toBe(response.headers['x-request-id']);
    });

    it('maps domain errors to their registry status', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/test-items/conflict')
        .expect(409);
      expect(response.body).toMatchObject({ code: 'CONFLICT', detail: 'Item already archived' });
    });

    it('never leaks the details of an unexpected error', async () => {
      const response = await request(app.getHttpServer())
        .get('/v1/test-items/unexpected')
        .expect(500);
      expect(response.body).toMatchObject({ code: 'INTERNAL_ERROR', title: 'Internal error' });
      expect(response.body.detail).toBeUndefined();
      expect(JSON.stringify(response.body)).not.toMatch(/secret|ECONNREFUSED|stack/);
    });
  });
});

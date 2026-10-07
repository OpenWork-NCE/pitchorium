import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiTestApp } from './support/api-app';
import { truncatePlatformTables } from './support/database';
import { TestItemsController } from './support/test-items.controller';

describe('Idempotency-Key', () => {
  let app: NestExpressApplication;
  let controller: TestItemsController;
  const post = (key: string | undefined, body: object) => {
    const pending = request(app.getHttpServer()).post('/v1/test-items').send(body);
    return key ? pending.set('Idempotency-Key', key) : pending;
  };

  beforeAll(async () => {
    ({ app } = await createApiTestApp([TestItemsController]));
    controller = app.get(TestItemsController);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncatePlatformTables();
    controller.created = 0;
  });

  it('requires the header on idempotent routes', async () => {
    const response = await post(undefined, { name: 'a', quantity: 1 }).expect(400);
    expect(response.body.code).toBe('IDEMPOTENCY_KEY_MISSING');
    expect(controller.created).toBe(0);
  });

  it('replays the stored response for the same key and payload', async () => {
    const first = await post('key-1', { name: 'a', quantity: 1 }).expect(201);
    const replay = await post('key-1', { name: 'a', quantity: 1 }).expect(201);

    expect(replay.body).toEqual(first.body);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(first.headers['idempotent-replayed']).toBeUndefined();
    expect(controller.created).toBe(1);
  });

  it('refuses to reuse a key with a different payload', async () => {
    await post('key-2', { name: 'a', quantity: 1 }).expect(201);
    const response = await post('key-2', { name: 'b', quantity: 1 }).expect(422);

    expect(response.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(controller.created).toBe(1);
  });

  it('releases the key when the request fails, so the client can retry', async () => {
    await post('key-3', { name: '', quantity: 1 }).expect(400);
    await post('key-3', { name: 'a', quantity: 1 }).expect(201);
    expect(controller.created).toBe(1);
  });
});

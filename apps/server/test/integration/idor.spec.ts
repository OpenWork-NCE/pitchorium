import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiTestApp } from './support/api-app';
import { truncateAllTables } from './support/database';
import { requestUpload } from './support/media';
import { createMember, type Member } from './support/members';

/**
 * Insecure direct object references (ASVS V4.2.1): a member who knows the identifier of
 * another member's private resource gets 404, as for a missing one, on reads and writes.
 */
describe('idor', () => {
  let app: NestExpressApplication;
  let owner: Member;
  let other: Member;
  const ids = { post: '', media: '', export: '' };

  beforeAll(async () => {
    ({ app } = await createApiTestApp());
    await truncateAllTables();
    owner = await createMember(app, 'idor-owner@example.test', { name: 'Owner' });
    other = await createMember(app, 'idor-other@example.test', { name: 'Other' });
    await owner.agent.get('/v1/me/profile').expect(200);
    await other.agent.get('/v1/me/profile').expect(200);

    const post = await owner.agent
      .post('/v1/posts')
      .set('Idempotency-Key', randomUUID())
      .send({ text: 'Visible by my connections only', visibility: 'connections' })
      .expect(201);
    ids.post = (post.body as { id: string }).id;
    ids.media = (
      await requestUpload(owner.agent, 'post_document', 'application/pdf', 1000)
    ).media.id;
    const exported = await owner.agent
      .post('/v1/me/privacy/exports')
      .set('Idempotency-Key', randomUUID())
      .expect(201);
    ids.export = (exported.body as { id: string }).id;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('lets the owner reach the resources', async () => {
    await owner.agent.get(`/v1/posts/${ids.post}`).expect(200);
    await owner.agent.get(`/v1/media/${ids.media}`).expect(200);
  });

  it.each([
    ['GET', '/v1/posts/{post}', undefined],
    ['PATCH', '/v1/posts/{post}', { text: 'Taken over' }],
    ['DELETE', '/v1/posts/{post}', undefined],
    ['GET', '/v1/posts/{post}/stats', undefined],
    ['GET', '/v1/media/{media}', undefined],
    ['GET', '/v1/media/{media}/download-url', undefined],
    ['DELETE', '/v1/media/{media}', undefined],
    ['POST', '/v1/media/{media}/confirm', undefined],
    ['POST', '/v1/me/privacy/exports/{export}/download-url', undefined],
  ] as const)('answers 404 to another member: %s %s', async (method, template, body) => {
    const path = template.replace(/\{(\w+)\}/, (_, key: keyof typeof ids) => ids[key]);
    const call = other.agent[method.toLowerCase() as 'get' | 'patch' | 'delete' | 'post'](path);
    const response = await (
      method === 'GET' ? call : call.set('Idempotency-Key', randomUUID())
    ).send(body);
    expect(response.status, JSON.stringify(response.body)).toBe(404);
  });

  it('left the resources untouched', async () => {
    const post = await owner.agent.get(`/v1/posts/${ids.post}`).expect(200);
    expect((post.body as { text: string }).text).toBe('Visible by my connections only');
    await owner.agent.get(`/v1/media/${ids.media}`).expect(200);
  });
});

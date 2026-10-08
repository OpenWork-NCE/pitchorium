import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import type { Post, Translation } from '@pitchorium/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApiTestApp } from './support/api-app';
import { query } from './support/database';
import { createFullWorker } from './support/full-worker';
import { createMember, grantRoleWith2fa, type Member } from './support/members';
import { connectMembers, handleOf, write } from './support/messaging';

/** Translation on demand (§8.3, ADR 0076) through the simulated provider. */
describe('localization', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  let amina: Member;
  let kofi: Member;
  let awa: Member;

  const translate = (member: Member, body: object) =>
    member.agent.post('/v1/translations').send({ targetLocale: 'en', ...body });

  beforeAll(async () => {
    ({ app } = await createApiTestApp([], { LOCALIZATION_MEMBER_DAILY_CHARACTERS: '400' }));
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await worker?.close();
    await app?.close();
  });

  beforeEach(async () => {
    // The worker truncates the tables when it starts, then inserts the default glossary.
    await worker?.close();
    worker = await createFullWorker();
    amina = await createMember(app, 'amina@example.com', { name: 'Amina Diop' });
    kofi = await createMember(app, 'kofi@example.com', { name: 'Kofi Mensah' });
    awa = await createMember(app, 'awa@example.com', { name: 'Awa Ndiaye' });
    for (const member of [amina, kofi, awa]) await handleOf(member);
  });

  it('translates on demand with the notice, from the cache until the content changes', async () => {
    const created = await amina.agent
      .post('/v1/posts')
      .set('Idempotency-Key', randomUUID())
      .send({
        text: 'Le premier palier de notre campagne est atteint.',
        visibility: 'members',
        language: 'fr',
      })
      .expect(201);
    const post = created.body as Post;
    const first = (await translate(kofi, { sourceType: 'post', sourceId: post.id }).expect(200))
      .body as Translation;
    expect(first).toEqual({
      sourceType: 'post',
      sourceId: post.id,
      targetLocale: 'en',
      sourceLanguage: 'fr',
      // The business glossary goes to the provider: « palier » is a tier.
      fields: { text: '[en] Le premier tier de notre campagne est atteint.' },
      machineTranslated: true,
      provider: 'simulated',
      notice: 'common.machineTranslation',
      cached: false,
    });
    expect(
      (
        (await translate(kofi, { sourceType: 'post', sourceId: post.id }).expect(200))
          .body as Translation
      ).cached,
    ).toBe(true);

    await amina.agent
      .patch(`/v1/posts/${post.id}`)
      .send({ text: 'Le second palier est atteint.' })
      .expect(200);
    const changed = (await translate(kofi, { sourceType: 'post', sourceId: post.id }).expect(200))
      .body as Translation;
    expect(changed).toMatchObject({
      cached: false,
      fields: { text: '[en] Le second tier est atteint.' },
    });

    // Only active locales; a content the reader may not see is not found.
    expect(
      (
        await translate(kofi, { sourceType: 'post', sourceId: post.id, targetLocale: 'sw' }).expect(
          422,
        )
      ).body.code,
    ).toBe('LOCALIZATION_LOCALE_NOT_ACTIVE');
    expect(
      (
        await translate(kofi, { sourceType: 'post', sourceId: post.id, targetLocale: 'fr' }).expect(
          422,
        )
      ).body.code,
    ).toBe('LOCALIZATION_ALREADY_IN_LANGUAGE');
    await translate(kofi, { sourceType: 'post', sourceId: randomUUID() }).expect(404);
  });

  it('translates a message for a participant only, without caching it', async () => {
    await connectMembers(amina, kofi);
    const message = await write(amina, await handleOf(kofi), 'Bonjour, merci pour votre soutien.');
    const translated = (
      await translate(kofi, { sourceType: 'message', sourceId: message.id }).expect(200)
    ).body as Translation;
    expect(translated.fields['text']).toMatch(/^\[en\] /);
    expect(
      (await translate(awa, { sourceType: 'message', sourceId: message.id }).expect(404)).body.code,
    ).toBe('LOCALIZATION_SOURCE_NOT_FOUND');
    const [cached] = await query<{ count: string }>(
      `SELECT count(*) FROM localization.translations WHERE source_type = 'message'`,
    );
    expect(Number(cached?.count)).toBe(0);
  });

  it('stops at the daily limit of a member and at the monthly cap of the platform', async () => {
    const long = 'Une présentation détaillée de notre coopérative agricole. '.repeat(4);
    const posts: string[] = [];
    for (let index = 0; index < 2; index += 1) {
      const created = await amina.agent
        .post('/v1/posts')
        .set('Idempotency-Key', randomUUID())
        .send({ text: `${index} ${long}`, visibility: 'members', language: 'fr' })
        .expect(201);
      posts.push((created.body as Post).id);
    }
    await translate(kofi, { sourceType: 'post', sourceId: posts[0] }).expect(200);
    expect(
      (await translate(kofi, { sourceType: 'post', sourceId: posts[1] }).expect(429)).body.code,
    ).toBe('LOCALIZATION_MEMBER_LIMIT_REACHED');
    const month = new Date().toISOString().slice(0, 7);
    await query('UPDATE localization.monthly_usage SET characters = 500000 WHERE month = $1', [
      month,
    ]);
    expect(
      (await translate(awa, { sourceType: 'post', sourceId: posts[1] }).expect(503)).body.code,
    ).toBe('LOCALIZATION_MONTHLY_CAP_REACHED');

    const admin = await createMember(app, 'admin@example.com', { name: 'Admin' });
    await grantRoleWith2fa(admin, 'admin');
    expect((await admin.agent.get('/v1/admin/localization/usage').expect(200)).body).toMatchObject({
      month,
      characters: 500000,
      monthlyCap: 500000,
      providers: ['simulated'],
    });
    const glossary = (await admin.agent.get('/v1/admin/localization/glossary').expect(200)).body
      .items as { fr: string; provisional: boolean }[];
    expect(glossary.find((term) => term.fr === 'palier')).toMatchObject({ provisional: true });
  });
});

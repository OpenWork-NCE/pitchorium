import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import type { FeedItem, FeedPage, Post } from '@pitchorium/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessModule } from '../../src/modules/access';
import { ContentFacade, ContentModule } from '../../src/modules/content';
import { ContentMaintenanceService } from '../../src/modules/content/application/content-maintenance.service';
import { IdentityModule } from '../../src/modules/identity';
import { ImpactModule } from '../../src/modules/impact';
import { MediaModule } from '../../src/modules/media';
import { MalwareScanner } from '../../src/modules/media/application/ports';
import { NetworkModule } from '../../src/modules/network';
import { OrganizationsModule } from '../../src/modules/organizations';
import { ProfilesModule } from '../../src/modules/profiles';
import { AuditModule } from '../../src/platform/audit';
import { FeatureFlagsModule } from '../../src/platform/feature-flags';
import { MailerModule } from '../../src/platform/mailer';
import { SafeHttpClient } from '../../src/platform/outbound';
import { OutboxRelayService } from '../../src/platform/outbox';
import { StorageModule } from '../../src/platform/storage';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { FakeMalwareScanner } from './support/fake-malware-scanner';
import { minimalPdf, png } from './support/files';
import { uploadFile, waitUntilProcessed } from './support/media';
import { createMember, ensureMinimumProfile, type Member } from './support/members';
import { createWorkerTestingModule } from './support/worker-testing-module';

/** Publications, reposts, reactions, comments, blocks, feed and statistics (§10.3). */
type PostFeedItem = Extract<FeedItem, { type: 'post' | 'repost' | 'featured' }>;

describe('content', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  let site: Server;
  let siteOrigin: string;
  let ama: Member;
  let kofi: Member;
  let awa: Member;
  const deliver = () => worker.get(OutboxRelayService).relayBatch();

  async function member(email: string, name: string, verified = true): Promise<Member> {
    const created = await createMember(app, email, { name, verified });
    await created.agent.get('/v1/me/profile').expect(200);
    return created;
  }

  async function publish(author: Member, body: object): Promise<Post> {
    const response = await author.agent
      .post('/v1/posts')
      .set('Idempotency-Key', `post-${Math.random()}`)
      .send(body);
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    return response.body as Post;
  }

  async function connect(a: Member, b: Member, bHandle: string): Promise<void> {
    await ensureMinimumProfile(a);
    const sent = await a.agent
      .post('/v1/network/connection-requests')
      .set('Idempotency-Key', `request-${Math.random()}`)
      .send({ handle: bHandle })
      .expect(201);
    await b.agent.post(`/v1/network/connection-requests/${sent.body.id}/accept`).expect(200);
  }

  /** The publications of the feed: no project exists in these tests. */
  const feedOf = async (reader: Member) => {
    const page = (await reader.agent.get('/v1/feed').expect(200)).body as FeedPage;
    return {
      ...page,
      items: page.items.filter(
        (item): item is PostFeedItem =>
          item.type === 'post' || item.type === 'repost' || item.type === 'featured',
      ),
    };
  };

  const eventTypes = async (prefix: string) =>
    (
      await query<{ event_type: string }>(
        `SELECT event_type FROM platform.outbox_events WHERE event_type LIKE $1
         ORDER BY occurred_at, event_type`,
        [`${prefix}%`],
      )
    ).map((event) => event.event_type);

  beforeAll(async () => {
    site = createServer((request, response) => {
      if (request.url === '/article') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(`<html><head><title>Fallback</title>
          <meta property="og:title" content="Irrigation solaire à Thiès">
          <meta property="og:description" content="Une coopérative de 40 maraîchères.">
          <meta property="og:site_name" content="Sahel Agri">
          <meta property="og:image" content="/cover.png"></head></html>`);
        return;
      }
      if (request.url === '/cover.png') {
        void png(600, 315).then((image) => {
          response.writeHead(200, { 'Content-Type': 'image/png' });
          response.end(image);
        });
        return;
      }
      response.writeHead(404).end();
    });
    await new Promise<void>((resolve) => site.listen(0, '127.0.0.1', resolve));
    siteOrigin = `http://site.test:${(site.address() as AddressInfo).port}`;

    ({ app } = await createApiTestApp(
      [],
      { CONTENT_FEED_EDITORIAL_THRESHOLD: '3' },
      { storage: 'minio' },
    ));
    // The test site is on loopback: here loopback plays a public address of site.test.
    const outbound = new SafeHttpClient(
      (host) => Promise.resolve(host === 'site.test' ? ['127.0.0.1'] : []),
      (address) => address === '127.0.0.1',
      () => true,
    );
    worker = await createWorkerTestingModule(
      [],
      [
        FeatureFlagsModule,
        AuditModule,
        MailerModule,
        StorageModule,
        IdentityModule.forWorker(),
        AccessModule.forWorker(),
        MediaModule.forWorker(),
        ImpactModule.forWorker(),
        ProfilesModule.forWorker(),
        OrganizationsModule.forWorker(),
        NetworkModule.forWorker(),
        ContentModule.forWorker(),
      ],
      (builder) =>
        builder
          .overrideProvider(MalwareScanner)
          .useValue(new FakeMalwareScanner())
          .overrideProvider(SafeHttpClient)
          .useValue(outbound),
    );
  });

  afterAll(async () => {
    await worker.close();
    await app.close();
    site.closeAllConnections();
    await new Promise((resolve) => site.close(resolve));
  });

  beforeEach(async () => {
    await truncateAllTables();
    ama = await member('ama@example.com', 'Ama Owusu');
    kofi = await member('kofi@example.com', 'Kofi Mensah');
    awa = await member('awa@example.com', 'Awa Ndiaye');
  });

  it('publishes images, a document and a link, and imports the preview image', async () => {
    const images = [
      await uploadFile(ama.agent, await png(800, 600), 'post_image', 'image/png'),
      await uploadFile(ama.agent, await png(800, 600), 'post_image', 'image/png'),
    ];
    const document = await uploadFile(ama.agent, minimalPdf(), 'post_document', 'application/pdf');
    for (const id of [...images, document]) await waitUntilProcessed(ama.agent, id, deliver);

    const both = await ama.agent
      .post('/v1/posts')
      .set('Idempotency-Key', 'both')
      .send({
        text: 'Trop',
        images: images.map((mediaId) => ({ mediaId })),
        documentMediaId: document,
      })
      .expect(422);
    expect(both.body.code).toBe('CONTENT_MEDIA_COMBINATION');
    const notPublic = await ama.agent
      .post('/v1/posts')
      .set('Idempotency-Key', 'public')
      .send({ text: 'Public', visibility: 'public' })
      .expect(422);
    expect(notPublic.body.code).toBe('CONTENT_PUBLIC_VISIBILITY_NOT_ALLOWED');

    const withImages = await publish(ama, {
      text: 'Nous lançons la récolte avec @kofi-mensah et toute la coopérative.',
      images: [
        { mediaId: images[0], alt: 'Les membres de la coopérative devant les panneaux solaires' },
        { mediaId: images[1] },
      ],
    });
    expect(withImages).toMatchObject({
      visibility: 'members',
      language: 'fr',
      languageSource: 'detected',
      mentions: [
        { token: '@kofi-mensah', type: 'member', key: 'kofi-mensah', displayName: 'Kofi Mensah' },
      ],
    });
    expect(withImages.images).toHaveLength(2);
    // The text alternatives, written by the author, in the order of the images.
    expect(withImages.images.map((image) => image.alt)).toEqual([
      'Les membres de la coopérative devant les panneaux solaires',
      null,
    ]);
    const described = (
      await ama.agent
        .patch(`/v1/posts/${withImages.id}`)
        .send({
          imageAlts: [
            { mediaId: images[0], alt: null },
            { mediaId: images[1], alt: 'Le séchoir solaire en fonctionnement' },
          ],
        })
        .expect(200)
    ).body as Post;
    expect(described.images.map((image) => image.alt)).toEqual([
      null,
      'Le séchoir solaire en fonctionnement',
    ]);
    // Accessibility is not an edition of the publication.
    expect(described.editedAt).toBeNull();
    const foreign = await ama.agent
      .patch(`/v1/posts/${withImages.id}`)
      .send({ imageAlts: [{ mediaId: document, alt: 'Pas une image de la publication' }] })
      .expect(422);
    expect(foreign.body.code).toBe('CONTENT_MEDIA_NOT_IN_POST');
    const tooLong = await ama.agent
      .patch(`/v1/posts/${withImages.id}`)
      .send({ imageAlts: [{ mediaId: images[0], alt: 'a'.repeat(1001) }] })
      .expect(400);
    expect(tooLong.body.errors[0]).toMatchObject({ pointer: '/imageAlts/0/alt', code: 'too_big' });
    // A members-only publication: its images are private files with presigned URLs.
    expect(withImages.images[0]?.url).toContain('X-Amz-Signature=');
    expect((await fetch(withImages.images[0]?.url ?? '')).status).toBe(200);

    const withDocument = await publish(ama, {
      text: 'Notre pitch deck',
      documentMediaId: document,
      documentTitle: 'pitch-deck-2026.pdf',
    });
    expect(withDocument.document).toMatchObject({
      mediaId: document,
      pageCount: 1,
      title: 'pitch-deck-2026.pdf',
    });
    const renamed = (
      await ama.agent
        .patch(`/v1/posts/${withDocument.id}`)
        .send({ documentTitle: 'Pitch deck 2026' })
        .expect(200)
    ).body as Post;
    expect(renamed.document?.title).toBe('Pitch deck 2026');
    await kofi.agent.get(`/v1/media/${document}/download-url`).expect(200);

    const withLink = await publish(ama, { linkUrl: `${siteOrigin}/article` });
    expect(withLink.link).toMatchObject({ status: 'pending', title: null });
    const ready = await vi.waitFor(
      async () => {
        await deliver();
        const read = (await kofi.agent.get(`/v1/posts/${withLink.id}`).expect(200)).body as Post;
        expect(read.link?.imageUrl).toBeTruthy();
        return read;
      },
      { timeout: 30_000, interval: 250 },
    );
    expect(ready.link).toMatchObject({
      status: 'ready',
      title: 'Irrigation solaire à Thiès',
      description: 'Une coopérative de 40 maraîchères.',
      siteName: 'Sahel Agri',
    });
    // The preview image is served by the platform, never hotlinked from the site.
    expect(ready.link?.imageUrl).not.toContain(siteOrigin);
    expect(await eventTypes('content.')).toEqual(
      expect.arrayContaining(['content.post.created.v1', 'content.mention.created.v1']),
    );
  });

  it('previews a link before publishing, then the publication reuses the preview', async () => {
    const asked = await ama.agent
      .post('/v1/link-previews')
      .send({ url: `${siteOrigin}/article` })
      .expect(201);
    expect(asked.body).toMatchObject({ status: 'pending', title: null, imageUrl: null });
    const id = asked.body.id as string;
    // Only its author reads it.
    await kofi.agent.get(`/v1/link-previews/${id}`).expect(404);
    const ready = await vi.waitFor(
      async () => {
        await deliver();
        const read = (await ama.agent.get(`/v1/link-previews/${id}`).expect(200)).body as {
          status: string;
          imageUrl: string | null;
        };
        expect(read.status).toBe('ready');
        expect(read.imageUrl).toBeTruthy();
        return read;
      },
      { timeout: 30_000, interval: 250 },
    );
    expect(ready).toMatchObject({ title: 'Irrigation solaire à Thiès', siteName: 'Sahel Agri' });
    expect(ready.imageUrl).not.toContain(siteOrigin);

    const post = await publish(ama, { linkUrl: `${siteOrigin}/article`, linkPreviewId: id });
    // Built already: the publication shows it at once, with its image, and the preview is used.
    expect(post.link).toMatchObject({ status: 'ready', title: 'Irrigation solaire à Thiès' });
    expect(post.link?.imageUrl).toBeTruthy();
    await ama.agent.get(`/v1/link-previews/${id}`).expect(404);

    // Another link than the one previewed: the publication builds its own preview.
    const other = await ama.agent
      .post('/v1/link-previews')
      .send({ url: `${siteOrigin}/article` })
      .expect(201);
    const mismatch = await publish(ama, {
      linkUrl: `${siteOrigin}/autre`,
      linkPreviewId: other.body.id as string,
    });
    expect(mismatch.link).toMatchObject({ status: 'pending' });
    await ama.agent.post('/v1/link-previews').send({ url: 'ftp://site.test/file' }).expect(400);
  });

  it('lists the publications of a member and of an organization as each reader may see them', async () => {
    await ama.agent
      .patch('/v1/me/profile/visibility')
      .send({ publicPageEnabled: true })
      .expect(200);
    await connect(ama, awa, 'awa-ndiaye');
    const open = await publish(ama, { text: 'Pour tout le monde', visibility: 'public' });
    const members = await publish(ama, { text: 'Pour les membres' });
    const close = await publish(ama, { text: 'Entre nous', visibility: 'connections' });
    const texts = (page: { items: Post[] }) => page.items.map((post) => post.id);

    const byConnection = (await awa.agent.get('/v1/members/ama-owusu/posts').expect(200)).body as {
      items: Post[];
    };
    expect(texts(byConnection)).toEqual([close.id, members.id, open.id]);
    const byMember = (await kofi.agent.get('/v1/members/ama-owusu/posts').expect(200)).body as {
      items: Post[];
    };
    expect(texts(byMember)).toEqual([members.id, open.id]);
    const paged = (
      await kofi.agent.get('/v1/members/ama-owusu/posts').query({ limit: 1 }).expect(200)
    ).body as { items: Post[]; nextCursor: string };
    // The first row is not Kofi's to see: the page is shorter, the cursor goes on.
    expect(paged.items).toEqual([]);
    expect(paged.nextCursor).toEqual(expect.any(String));
    const visitor = await request(app.getHttpServer())
      .get('/v1/public/members/ama-owusu/posts')
      .expect(200);
    expect(texts(visitor.body as { items: Post[] })).toEqual([open.id]);
    expect(visitor.headers['cache-control']).toBe('public, max-age=60');
    // Without a public page, nothing for a visitor.
    await request(app.getHttpServer()).get('/v1/public/members/kofi-mensah/posts').expect(404);
    await kofi.agent.get('/v1/members/nobody-here/posts').expect(404);

    const organization = (
      await ama.agent
        .post('/v1/organizations')
        .set('Idempotency-Key', `organization-${Math.random()}`)
        .send({ name: 'Coopérative de Thiès', structureType: 'foundation', countryCodes: ['SN'] })
        .expect(201)
    ).body as { id: string; slug: string };
    const asOrganization = await publish(ama, {
      text: 'Au nom de la coopérative',
      organizationId: organization.id,
      visibility: 'public',
    });
    const ofOrganization = (
      await kofi.agent.get(`/v1/organizations/by-slug/${organization.slug}/posts`).expect(200)
    ).body as { items: Post[] };
    expect(texts(ofOrganization)).toEqual([asOrganization.id]);
    const publicOfOrganization = await request(app.getHttpServer())
      .get(`/v1/public/organizations/${organization.slug}/posts`)
      .expect(200);
    expect(texts(publicOfOrganization.body as { items: Post[] })).toEqual([asOrganization.id]);
    // The member's own list keeps what they publish as themselves.
    const own = (await ama.agent.get('/v1/members/ama-owusu/posts').expect(200)).body as {
      items: Post[];
    };
    expect(texts(own)).not.toContain(asOrganization.id);
  });

  it('lists who reacted by reaction, and tells its author a publication is hidden', async () => {
    const post = await publish(ama, { text: 'Qui réagit ?' });
    await kofi.agent.put(`/v1/posts/${post.id}/reaction`).send({ type: 'like' }).expect(200);
    await awa.agent.put(`/v1/posts/${post.id}/reaction`).send({ type: 'bravo' }).expect(200);
    const all = (await ama.agent.get(`/v1/posts/${post.id}/reactions`).expect(200)).body as {
      items: { member: { handle: string }; type: string }[];
    };
    expect(all.items.map((item) => [item.member.handle, item.type])).toEqual([
      ['awa-ndiaye', 'bravo'],
      ['kofi-mensah', 'like'],
    ]);
    const likes = (
      await ama.agent.get(`/v1/posts/${post.id}/reactions`).query({ type: 'like' }).expect(200)
    ).body as { items: { member: { handle: string } }[] };
    expect(likes.items.map((item) => item.member.handle)).toEqual(['kofi-mensah']);
    // A blocked member is left out of the list of the member who blocked them.
    await ama.agent.put('/v1/network/blocks/kofi-mensah').expect(204);
    const afterBlock = (await ama.agent.get(`/v1/posts/${post.id}/reactions`).expect(200)).body as {
      items: { member: { handle: string } }[];
    };
    expect(afterBlock.items.map((item) => item.member.handle)).toEqual(['awa-ndiaye']);

    expect(post.moderation).toBe('visible');
    await app.get(ContentFacade).setPostModerationStatus(post.id, 'hidden');
    const own = (await ama.agent.get(`/v1/posts/${post.id}`).expect(200)).body as Post;
    expect(own.moderation).toBe('hidden');
    await awa.agent.get(`/v1/posts/${post.id}`).expect(404);
  });

  it('refuses a repost outside of the audience of the publication', async () => {
    await connect(ama, kofi, 'kofi-mensah');
    await kofi.agent
      .patch('/v1/me/profile/visibility')
      .send({ publicPageEnabled: true })
      .expect(200);
    const forConnections = await publish(ama, { text: 'Entre nous', visibility: 'connections' });
    const refused = await kofi.agent
      .post(`/v1/posts/${forConnections.id}/reposts`)
      .set('Idempotency-Key', 'repost-connections')
      .send({ visibility: 'connections' })
      .expect(422);
    expect(refused.body.code).toBe('CONTENT_REPOST_NOT_ALLOWED');
    const forMembers = await publish(ama, { text: 'Pour les membres' });
    const widened = await kofi.agent
      .post(`/v1/posts/${forMembers.id}/reposts`)
      .set('Idempotency-Key', 'repost-public')
      .send({ visibility: 'public' })
      .expect(422);
    expect(widened.body.code).toBe('CONTENT_REPOST_NOT_ALLOWED');
    const reposted = await kofi.agent
      .post(`/v1/posts/${forMembers.id}/reposts`)
      .set('Idempotency-Key', 'repost-members')
      .send({ comment: 'À lire', visibility: 'members' })
      .expect(201);
    expect(reposted.body).toMatchObject({
      kind: 'repost',
      text: 'À lire',
      repostOf: { id: forMembers.id, text: 'Pour les membres' },
    });
    const original = (await awa.agent.get(`/v1/posts/${forMembers.id}`).expect(200)).body as Post;
    expect(original.repostCount).toBe(1);
    // A stranger to the connections cannot see it at all.
    await awa.agent.get(`/v1/posts/${forConnections.id}`).expect(404);
    expect(await eventTypes('content.post.reposted')).toEqual(['content.post.reposted.v1']);
  });

  it('keeps one reaction per member and target, with counts by type', async () => {
    const post = await publish(ama, { text: 'Merci pour votre soutien !' });
    const react = (reader: Member, type: string) =>
      reader.agent.put(`/v1/posts/${post.id}/reaction`).send({ type }).expect(200);
    await react(kofi, 'like');
    await react(awa, 'bravo');
    const changed = await react(kofi, 'support');
    expect(changed.body).toEqual({
      counts: { like: 0, bravo: 1, insightful: 0, support: 1 },
      total: 2,
      viewerReaction: 'support',
    });
    await awa.agent.delete(`/v1/posts/${post.id}/reaction`).expect(200);
    const read = (await ama.agent.get(`/v1/posts/${post.id}`).expect(200)).body as Post;
    expect(read.reactions).toEqual({
      counts: { like: 0, bravo: 0, insightful: 0, support: 1 },
      total: 1,
      viewerReaction: null,
    });
    const invalid = await kofi.agent
      .put(`/v1/posts/${post.id}/reaction`)
      .send({ type: 'laugh' })
      .expect(400);
    expect(invalid.body.code).toBe('VALIDATION_FAILED');
    expect(await eventTypes('content.reaction')).toEqual([
      'content.reaction.added.v1',
      'content.reaction.added.v1',
      'content.reaction.changed.v1',
      'content.reaction.removed.v1',
    ]);
  });

  it('runs comments and replies on one level, with their rights', async () => {
    const post = await publish(ama, { text: 'Vos questions sur le financement ?' });
    const comment = async (reader: Member, body: object, status = 201) => {
      const response = await reader.agent
        .post(`/v1/posts/${post.id}/comments`)
        .set('Idempotency-Key', `comment-${Math.random()}`)
        .send(body);
      expect(response.status, JSON.stringify(response.body)).toBe(status);
      return response.body as { id: string; code?: string };
    };
    const question = await comment(kofi, { text: 'Quel ticket minimum ?' });
    const answer = await comment(ama, { text: '500 euros.', parentId: question.id });
    expect((await comment(awa, { text: 'Et ensuite ?', parentId: answer.id }, 422)).code).toBe(
      'CONTENT_REPLY_DEPTH',
    );
    await kofi.agent
      .patch(`/v1/comments/${question.id}`)
      .send({ text: 'Quel ticket minimum, svp ?' })
      .expect(200);
    await awa.agent.patch(`/v1/comments/${question.id}`).send({ text: 'Piraté' }).expect(403);
    await kofi.agent
      .put(`/v1/comments/${question.id}/reaction`)
      .send({ type: 'insightful' })
      .expect(200);

    const list = await awa.agent.get(`/v1/posts/${post.id}/comments`).expect(200);
    expect(list.body.items).toEqual([
      expect.objectContaining({
        id: question.id,
        text: 'Quel ticket minimum, svp ?',
        replyCount: 1,
        editedAt: expect.any(String),
        viewerCanDelete: false,
      }),
    ]);
    const replies = await awa.agent.get(`/v1/comments/${question.id}/replies`).expect(200);
    expect(replies.body.items).toEqual([
      expect.objectContaining({ id: answer.id, parentId: question.id }),
    ]);

    // The author of the publication deletes a comment of someone else; a stranger cannot.
    await awa.agent.delete(`/v1/comments/${question.id}`).expect(403);
    await ama.agent.delete(`/v1/comments/${question.id}`).expect(204);
    expect((await ama.agent.get(`/v1/posts/${post.id}`).expect(200)).body.commentCount).toBe(1);

    await ama.agent.patch(`/v1/posts/${post.id}`).send({ commentsDisabled: true }).expect(200);
    expect((await comment(kofi, { text: 'Encore une' }, 409)).code).toBe(
      'CONTENT_COMMENTS_DISABLED',
    );
    const unverified = await member('new@example.com', 'New Member', false);
    const refused = await unverified.agent
      .post(`/v1/posts/${post.id}/comments`)
      .set('Idempotency-Key', 'unverified')
      .send({ text: 'Bonjour' })
      .expect(403);
    expect(refused.body.missing).toEqual(['email_verified']);
    expect(await eventTypes('content.comment')).toEqual([
      'content.comment.created.v1',
      'content.comment.created.v1',
      'content.comment.updated.v1',
      'content.comment.deleted.v1',
    ]);
  });

  it('applies blocks to the feed, the comments and the mentions', async () => {
    await kofi.agent.put('/v1/network/follows/member/ama-owusu').expect(200);
    await awa.agent.put('/v1/network/follows/member/ama-owusu').expect(200);
    const post = await publish(ama, { text: 'Bilan de la saison' });
    await kofi.agent
      .post(`/v1/posts/${post.id}/comments`)
      .set('Idempotency-Key', 'before-block')
      .send({ text: 'Bravo !' })
      .expect(201);
    expect((await feedOf(kofi)).items.map((item) => item.post.id)).toEqual([post.id]);

    await ama.agent.put('/v1/network/blocks/kofi-mensah').expect(204);
    // The block removed the follow and hides her publications, wherever Kofi looks for them.
    expect((await feedOf(kofi)).items).toEqual([]);
    await kofi.agent.get(`/v1/posts/${post.id}`).expect(404);
    await kofi.agent
      .post(`/v1/posts/${post.id}/comments`)
      .set('Idempotency-Key', 'after-block')
      .send({ text: 'Encore' })
      .expect(404);
    await kofi.agent.put(`/v1/posts/${post.id}/reaction`).send({ type: 'like' }).expect(404);
    const comments = await ama.agent.get(`/v1/posts/${post.id}/comments`).expect(200);
    expect(comments.body.items).toEqual([]);
    // A blocked member is unknown to the author, like a handle nobody holds: plain text.
    const mention = await ama.agent
      .post('/v1/posts')
      .set('Idempotency-Key', 'mention-blocked')
      .send({ text: 'Merci @kofi-mensah' })
      .expect(201);
    expect(mention.body.mentions).toEqual([]);
    // A third member mentioning Kofi: Ama does not see the mention, Awa does.
    await awa.agent.put('/v1/network/follows/member/kofi-mensah').expect(200);
    const third = await publish(awa, { text: 'Avec @kofi-mensah', visibility: 'members' });
    const seenByAma = await ama.agent.get(`/v1/posts/${third.id}`).expect(200);
    expect(seenByAma.body.mentions).toEqual([]);
    const seenByAwa = await awa.agent.get(`/v1/posts/${third.id}`).expect(200);
    expect(seenByAwa.body.mentions).toEqual([expect.objectContaining({ key: 'kofi-mensah' })]);
    expect((await feedOf(awa)).items.map((item) => item.post.id)).toContain(post.id);
  });

  it('completes the feed of a member whose network produces too little with highlights', async () => {
    const first = await publish(ama, { text: 'Appel à projets agriculture' });
    const second = await publish(kofi, { text: 'Retour sur le forum de Kigali' });
    // Featured through the administration (admin tests); the latest first.
    await query(
      `UPDATE content.posts SET featured_at = now() - interval '1 minute' WHERE id = $1`,
      [first.id],
    );
    await query(`UPDATE content.posts SET featured_at = now() WHERE id = $1`, [second.id]);

    const own = await publish(awa, { text: 'Ma première publication' });
    const feed = await feedOf(awa);
    expect(feed.schemaVersion).toBe(1);
    expect(feed.items.map((item) => [item.type, item.post.id])).toEqual([
      ['post', own.id],
      ['featured', second.id],
      ['featured', first.id],
    ]);
    const page = await awa.agent.get('/v1/feed?limit=2').expect(200);
    const next = await awa.agent.get(`/v1/feed?limit=2&cursor=${page.body.nextCursor}`).expect(200);
    expect(
      [...page.body.items, ...next.body.items].map((item: { post: Post }) => item.post.id),
    ).toEqual([own.id, second.id, first.id]);
    // Once the network produces enough, no highlight is added.
    for (const text of ['Un', 'Deux', 'Trois']) await publish(awa, { text });
    expect((await feedOf(awa)).items.every((item) => item.type === 'post')).toBe(true);
  });

  it('counts the newer publications of the network after the head of the first page', async () => {
    await kofi.agent.put('/v1/network/follows/member/ama-owusu').expect(200);
    await publish(ama, { text: 'Déjà lue' });
    const first = await feedOf(kofi);
    expect(first.head).toEqual(expect.any(String));
    const newer = async () =>
      (
        await kofi.agent
          .get('/v1/feed/newer')
          .query({ head: first.head ?? '' })
          .expect(200)
      ).body as { count: number; capped: boolean };
    expect(await newer()).toEqual({ count: 0, capped: false });

    await publish(ama, { text: 'Nouvelle publication' });
    await publish(ama, { text: 'Une autre' });
    // Reserved to her connections: Kofi only follows her, it is not his to see.
    await publish(ama, { text: 'Entre nous', visibility: 'connections' });
    // The reader's own publications appear as they publish: never counted.
    await publish(kofi, { text: 'La mienne' });
    expect(await newer()).toEqual({ count: 2, capped: false });

    for (let index = 0; index < 20; index += 1) await publish(ama, { text: `Série ${index}` });
    expect(await newer()).toEqual({ count: 20, capped: true });

    // Without any item, the head is the time of the reading.
    const empty = await feedOf(awa);
    expect(empty.head).toEqual(expect.any(String));
    await awa.agent.get('/v1/feed/newer').query({ head: 'not a cursor' }).expect(400);
  });

  it('counts the publications a member saw, once a day, and consolidates them for the author', async () => {
    await kofi.agent.put('/v1/network/follows/member/ama-owusu').expect(200);
    const post = await publish(ama, { text: 'Combien de vues ?' });
    const restricted = await publish(ama, { text: 'Entre nous', visibility: 'connections' });
    // A loaded feed is not a seen one (ADR 0116): only the signal of the browser counts.
    await feedOf(kofi);
    const signal = (agent: typeof kofi.agent, postIds: string[]) =>
      agent.post('/v1/posts/views').send({ postIds }).expect(204);
    await signal(kofi.agent, [post.id, restricted.id]);
    // Sent again, the same signal counts once; the author's own view never counts.
    await signal(kofi.agent, [post.id]);
    await signal(ama.agent, [post.id]);
    // The page of the publication counts as a view.
    await awa.agent.get(`/v1/posts/${post.id}`).expect(200);
    await ama.agent.get(`/v1/posts/${post.id}`).expect(200);
    const tooMany = await kofi.agent
      .post('/v1/posts/views')
      .send({ postIds: Array.from({ length: 51 }, () => post.id) })
      .expect(400);
    expect(tooMany.body.errors[0]).toMatchObject({ pointer: '/postIds', code: 'too_big' });

    const maintenance = worker.get(ContentMaintenanceService);
    await vi.waitFor(
      async () => {
        await maintenance.consolidateViews();
        const stats = await ama.agent.get(`/v1/posts/${post.id}/stats`).expect(200);
        expect(stats.body.days).toEqual([
          { day: new Date().toISOString().slice(0, 10), uniqueViewers: 2 },
        ]);
        // Kofi is not a connection of Ama: his signal of her restricted publication is ignored.
        const hidden = await ama.agent.get(`/v1/posts/${restricted.id}/stats`).expect(200);
        expect(hidden.body.days).toEqual([]);
      },
      { timeout: 10_000, interval: 200 },
    );
    await kofi.agent.get(`/v1/posts/${post.id}/stats`).expect(403);
  });

  it('withdraws the public publications of a member who disables their public page', async () => {
    await ama.agent
      .patch('/v1/me/profile/visibility')
      .send({ publicPageEnabled: true })
      .expect(200);
    const image = await uploadFile(ama.agent, await png(800, 600), 'post_image', 'image/png');
    await waitUntilProcessed(ama.agent, image, deliver);
    const post = await publish(ama, {
      text: 'Ouvert à tous',
      visibility: 'public',
      images: [{ mediaId: image, alt: 'Une parcelle irriguée' }],
    });
    const publicView = await vi.waitFor(
      async () => {
        await deliver();
        const read = (await kofi.agent.get(`/v1/posts/${post.id}`).expect(200)).body as Post;
        expect(read.images[0]?.url).not.toContain('X-Amz-Signature=');
        return read;
      },
      { timeout: 20_000, interval: 200 },
    );
    expect(publicView.visibility).toBe('public');

    await ama.agent
      .patch('/v1/me/profile/visibility')
      .send({ publicPageEnabled: false })
      .expect(200);
    // At once at read time, then rewritten by the worker, files moved to the private bucket.
    expect(
      ((await kofi.agent.get(`/v1/posts/${post.id}`).expect(200)).body as Post).visibility,
    ).toBe('members');
    await vi.waitFor(
      async () => {
        await deliver();
        const [row] = await query<{ visibility: string }>(
          'SELECT visibility FROM content.posts WHERE id = $1',
          [post.id],
        );
        expect(row?.visibility).toBe('members');
        const read = (await kofi.agent.get(`/v1/posts/${post.id}`).expect(200)).body as Post;
        expect(read.images[0]?.url).toContain('X-Amz-Signature=');
      },
      { timeout: 20_000, interval: 200 },
    );
  });
});

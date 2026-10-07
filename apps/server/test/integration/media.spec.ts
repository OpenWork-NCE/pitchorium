import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';
import sharp from 'sharp';
import type { StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaFacade, MediaModule } from '../../src/modules/media';
import { MediaMaintenanceService } from '../../src/modules/media/application/media-maintenance.service';
import { MediaProcessingService } from '../../src/modules/media/application/media-processing.service';
import { MalwareScanner } from '../../src/modules/media/application/ports';
import { OutboxRelayService } from '../../src/platform/outbox';
import { ObjectStorage, StorageModule } from '../../src/platform/storage';
import { createApiTestApp } from './support/api-app';
import { EICAR, startClamAv } from './support/clamav';
import { query, truncateAllTables } from './support/database';
import { corruptPdf, jpegWithExif, minimalPdf, png } from './support/files';
import { putToStorage, requestUpload, uploadFile, waitUntilProcessed } from './support/media';
import { createMember, type Member } from './support/members';
import { createWorkerTestingModule } from './support/worker-testing-module';

const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Upload, checks and processing against real MinIO and ClamAV (ADR 0022, ADR 0023). */
describe('media', () => {
  let app: NestExpressApplication;
  let worker: TestingModule;
  let clamav: StartedTestContainer;
  let member: Member;
  const deliver = () => worker.get(OutboxRelayService).relayBatch();

  beforeAll(async () => {
    clamav = await startClamAv();
    process.env['CLAMAV_HOST'] = clamav.getHost();
    process.env['CLAMAV_PORT'] = String(clamav.getMappedPort(3310));
    ({ app } = await createApiTestApp(
      [],
      { MEDIA_QUOTA_MAX_FILES: '4', MEDIA_UPLOAD_REQUESTS_PER_HOUR: '6' },
      { storage: 'minio' },
    ));
    worker = await createWorkerTestingModule([], [StorageModule, MediaModule.forWorker()]);
  }, 300_000);

  afterAll(async () => {
    await worker.close();
    await app.close();
    await clamav.stop();
  });

  beforeEach(async () => {
    await truncateAllTables();
    member = await createMember(app, 'files@example.com');
  });

  it('stores an image upright, without metadata, in WebP and AVIF variants', async () => {
    const original = await jpegWithExif();
    const before = await sharp(original).metadata();
    expect(before.exif).toBeDefined();
    expect(before.orientation).toBe(6);

    const id = await uploadFile(member.agent, original, 'post_image', 'image/jpeg');
    const media = await waitUntilProcessed(member.agent, id, deliver);

    expect(media).toMatchObject({
      status: 'ready',
      contentType: 'image/jpeg',
      visibility: 'public',
      width: 800,
      height: 1200,
      rejectionReason: null,
    });
    const large = media.variants['large'];
    expect(large).toMatchObject({ width: 800, height: 1200 });
    const webp = await fetch(large?.webp ?? '');
    expect(webp.status).toBe(200);
    expect(webp.headers.get('cache-control')).toBe(IMMUTABLE);
    const produced = await sharp(Buffer.from(await webp.arrayBuffer())).metadata();
    expect(produced).toMatchObject({ format: 'webp', width: 800, height: 1200 });
    expect(produced.exif).toBeUndefined();
    expect(produced.orientation).toBeUndefined();
    const avif = await fetch(large?.avif ?? '');
    expect((await sharp(Buffer.from(await avif.arrayBuffer())).metadata()).exif).toBeUndefined();

    expect(await worker.get(ObjectStorage).headObject('private', `quarantine/${id}`)).toBeNull();
    const events = await query<{ event_type: string }>(
      'SELECT event_type FROM platform.outbox_events WHERE aggregate_id = $1 ORDER BY occurred_at',
      [id],
    );
    expect(events.map((event) => event.event_type)).toEqual([
      'media.asset.requested.v1',
      'media.asset.uploaded.v1',
      'media.asset.ready.v1',
    ]);
  });

  it('signs the declared type and exact size into the upload URL', async () => {
    const image = await png(400, 400);
    const ticket = await requestUpload(member.agent, 'avatar', 'image/png', image.length);

    const wrongType = await putToStorage(ticket, image, {
      ...ticket.upload.headers,
      'Content-Type': 'image/jpeg',
    });
    expect(wrongType.status).toBe(403);
    const longer = Buffer.concat([image, Buffer.alloc(16)]);
    const wrongSize = await putToStorage(ticket, longer, {
      'Content-Type': ticket.upload.headers['Content-Type'] ?? '',
    });
    expect(wrongSize.status).toBe(403);
    await member.agent.post(`/v1/media/${ticket.media.id}/confirm`).expect(409);

    expect((await putToStorage(ticket, image)).status).toBe(200);
    await member.agent.post(`/v1/media/${ticket.media.id}/confirm`).expect(200);
  });

  it('rejects a file whose real type differs from the declared one', async () => {
    const id = await uploadFile(member.agent, await png(400, 400), 'avatar', 'image/jpeg');
    const media = await waitUntilProcessed(member.agent, id, deliver);
    expect(media).toMatchObject({ status: 'rejected', rejectionReason: 'type_mismatch' });
    expect(media.variants).toEqual({});
    const [rejected] = await query<{ payload: Record<string, unknown> }>(
      `SELECT payload FROM platform.outbox_events WHERE event_type = 'media.asset.rejected.v1'`,
    );
    expect(rejected?.payload).toMatchObject({ reason: 'type_mismatch', usage: 'avatar' });
  });

  it('rejects the EICAR test file found by ClamAV', async () => {
    const id = await uploadFile(member.agent, EICAR, 'message_attachment', 'image/png');
    const media = await waitUntilProcessed(member.agent, id, deliver);
    expect(media).toMatchObject({ status: 'rejected', rejectionReason: 'malware_detected' });
    expect(await worker.get(ObjectStorage).headObject('private', `quarantine/${id}`)).toBeNull();
  });

  it('accepts a valid PDF with its page count and thumbnail, rejects a corrupt one', async () => {
    const pdf = minimalPdf();
    const id = await uploadFile(member.agent, pdf, 'post_document', 'application/pdf');
    const media = await waitUntilProcessed(member.agent, id, deliver);
    expect(media).toMatchObject({
      status: 'ready',
      visibility: 'private',
      pageCount: 1,
      fileUrl: null,
    });
    expect(media.variants['thumbnail']).toMatchObject({ width: 800, webp: null });

    const download = await member.agent.get(`/v1/media/${id}/download-url`).expect(200);
    expect(download.body.expiresAt).not.toBeNull();
    const file = await fetch(download.body.url as string);
    expect(file.status).toBe(200);
    expect(Buffer.from(await file.arrayBuffer()).equals(pdf)).toBe(true);
    const thumbnail = await member.agent
      .get(`/v1/media/${id}/download-url`)
      .query({ variant: 'thumbnail' })
      .expect(200);
    expect((await fetch(thumbnail.body.url as string)).headers.get('content-type')).toBe(
      'image/webp',
    );

    const broken = await uploadFile(member.agent, corruptPdf(), 'post_document', 'application/pdf');
    expect(await waitUntilProcessed(member.agent, broken, deliver)).toMatchObject({
      status: 'rejected',
      rejectionReason: 'pdf_unreadable',
    });
  });

  it('refuses a private file to a member who may not read it', async () => {
    const id = await uploadFile(member.agent, minimalPdf(), 'post_document', 'application/pdf');
    await waitUntilProcessed(member.agent, id, deliver);
    const stranger = await createMember(app, 'stranger@example.com');

    const refused = await stranger.agent.get(`/v1/media/${id}/download-url`).expect(404);
    expect(refused.body.code).toBe('MEDIA_NOT_FOUND');
    await stranger.agent.get(`/v1/media/${id}`).expect(404);
    await stranger.agent.delete(`/v1/media/${id}`).expect(404);
    await member.agent.get(`/v1/media/${id}/download-url`).expect(200);
  });

  it('enforces the storage quota', async () => {
    for (let index = 0; index < 4; index += 1) {
      await requestUpload(member.agent, 'post_image', 'image/png', 1000);
    }
    const refused = await member.agent
      .post('/v1/media/uploads')
      .set('Idempotency-Key', 'quota-exceeded')
      .send({ usage: 'post_image', contentType: 'image/png', size: 1000 })
      .expect(422);
    expect(refused.body.code).toBe('MEDIA_QUOTA_EXCEEDED');
  });

  it('limits the upload requests of each member per hour', async () => {
    // Deleting each pending upload keeps the quota free: only the hourly limit applies.
    for (let index = 0; index < 6; index += 1) {
      const ticket = await requestUpload(member.agent, 'post_image', 'image/png', 1000);
      await member.agent.delete(`/v1/media/${ticket.media.id}`).expect(204);
    }
    const refused = await member.agent
      .post('/v1/media/uploads')
      .set('Idempotency-Key', 'hourly-limit')
      .send({ usage: 'post_image', contentType: 'image/png', size: 1000 })
      .expect(429);
    expect(refused.body.code).toBe('RATE_LIMITED');

    const other = await createMember(app, 'other-uploader@example.com');
    await requestUpload(other.agent, 'post_image', 'image/png', 1000);
  });

  it('retries a failing processing, then rejects it with processing_failed on the last attempt', async () => {
    const ticket = await requestUpload(
      member.agent,
      'post_image',
      'image/png',
      (await png(400, 400)).length,
    );
    expect((await putToStorage(ticket, await png(400, 400))).status).toBe(200);
    await member.agent.post(`/v1/media/${ticket.media.id}/confirm`).expect(200);
    vi.spyOn(worker.get(MalwareScanner), 'scan').mockRejectedValue(new Error('clamd is down'));
    const processing = worker.get(MediaProcessingService);

    await expect(processing.process(ticket.media.id, false)).rejects.toThrow('clamd is down');
    expect((await member.agent.get(`/v1/media/${ticket.media.id}`)).body.status).toBe('processing');

    await processing.process(ticket.media.id, true);
    const media = (await member.agent.get(`/v1/media/${ticket.media.id}`).expect(200)).body;
    expect(media).toMatchObject({ status: 'rejected', rejectionReason: 'processing_failed' });
    const [rejected] = await query<{ payload: Record<string, unknown> }>(
      `SELECT payload FROM platform.outbox_events
       WHERE event_type = 'media.asset.rejected.v1' AND aggregate_id = $1`,
      [ticket.media.id],
    );
    expect(rejected?.payload).toMatchObject({ reason: 'processing_failed' });
    vi.restoreAllMocks();
  });

  it('deletes orphans and owner deletions logically, then purges their files', async () => {
    const orphan = await uploadFile(member.agent, await png(400, 400), 'post_image', 'image/png');
    const kept = await uploadFile(member.agent, await png(400, 400), 'post_image', 'image/png');
    const removed = await uploadFile(member.agent, await png(400, 400), 'post_image', 'image/png');
    const urls: string[] = [];
    for (const id of [orphan, kept, removed]) {
      const media = await waitUntilProcessed(member.agent, id, deliver);
      urls.push(media.variants['large']?.webp ?? '');
    }
    await worker.get(MediaFacade).attach({
      mediaId: kept,
      ownerId: member.userId,
      usage: 'post_image',
      resource: { type: 'test_post', id: 'post-1' },
    });
    await member.agent.delete(`/v1/media/${removed}`).expect(204);
    await query(`UPDATE media.assets SET unattached_since = now() - interval '2 days'`);

    const maintenance = worker.get(MediaMaintenanceService);
    expect(await maintenance.deleteOrphans()).toBe(1);
    expect(await maintenance.purgeDeleted()).toBe(2);

    await member.agent.get(`/v1/media/${orphan}`).expect(404);
    await member.agent.get(`/v1/media/${removed}`).expect(404);
    expect((await member.agent.get(`/v1/media/${kept}`).expect(200)).body.status).toBe('ready');
    expect((await fetch(urls[0] ?? '')).status).toBe(404);
    expect((await fetch(urls[1] ?? '')).status).toBe(200);
    expect((await fetch(urls[2] ?? '')).status).toBe(404);
    const deletions = await query<{ aggregate_id: string; payload: Record<string, unknown> }>(
      `SELECT aggregate_id, payload FROM platform.outbox_events
       WHERE event_type = 'media.asset.deleted.v1' ORDER BY occurred_at`,
    );
    expect(deletions.map((event) => [event.aggregate_id, event.payload['reason']])).toEqual([
      [removed, 'owner_request'],
      [orphan, 'orphan_cleanup'],
    ]);
  });
});

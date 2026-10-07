import { randomUUID } from 'node:crypto';
import type { MediaAsset, MediaUsage, UploadTicket } from '@pitchorium/contracts';
import { expect, vi } from 'vitest';
import type { Agent } from './members';

export async function requestUpload(
  agent: Agent,
  usage: MediaUsage,
  contentType: string,
  size: number,
): Promise<UploadTicket> {
  const response = await agent
    .post('/v1/media/uploads')
    .set('Idempotency-Key', randomUUID())
    .send({ usage, contentType, size });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body as UploadTicket;
}

/** PUT to the presigned URL, as a browser would, with the headers the api returned. */
export function putToStorage(
  ticket: UploadTicket,
  body: Buffer,
  headers: Record<string, string> = ticket.upload.headers,
): Promise<Response> {
  return fetch(ticket.upload.url, { method: 'PUT', headers, body });
}

/** Requests the URL, uploads the bytes and confirms: processing is then queued. */
export async function uploadFile(
  agent: Agent,
  body: Buffer,
  usage: MediaUsage,
  contentType: string,
): Promise<string> {
  const ticket = await requestUpload(agent, usage, contentType, body.length);
  expect((await putToStorage(ticket, body)).status).toBe(200);
  await agent.post(`/v1/media/${ticket.media.id}/confirm`).expect(200);
  return ticket.media.id;
}

/** Relays the outbox until the worker has settled the asset. */
export function waitUntilProcessed(
  agent: Agent,
  mediaId: string,
  deliver: () => Promise<unknown>,
): Promise<MediaAsset> {
  return vi.waitFor(
    async () => {
      await deliver();
      const media = (await agent.get(`/v1/media/${mediaId}`).expect(200)).body as MediaAsset;
      if (media.status === 'pending' || media.status === 'processing') {
        throw new Error(`Media ${mediaId} still ${media.status}`);
      }
      return media;
    },
    { timeout: 60_000, interval: 250 },
  );
}

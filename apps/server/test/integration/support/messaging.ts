import { randomUUID } from 'node:crypto';
import type { MediaUsage, Message } from '@pitchorium/contracts';
import { io, type Socket } from 'socket.io-client';
import { v7 } from 'uuid';
import { expect } from 'vitest';
import { query } from './database';
import { TEST_WEB_APP_URL } from './environment';
import { ensureMinimumProfile, type Member, signIn } from './members';

export async function handleOf(member: Member): Promise<string> {
  return ((await member.agent.get('/v1/me').expect(200)).body as { profile: { handle: string } })
    .profile.handle;
}

/** Both members get their profile (created on first read), then connect. */
export async function connectMembers(a: Member, b: Member): Promise<void> {
  await ensureMinimumProfile(a);
  const sent = await a.agent
    .post('/v1/network/connection-requests')
    .set('Idempotency-Key', randomUUID())
    .send({ handle: await handleOf(b) })
    .expect(201);
  await b.agent.post(`/v1/network/connection-requests/${sent.body.id}/accept`).expect(200);
}

/** A file of the member already processed (the media pipeline has its own tests). */
export async function readyMedia(
  ownerId: string,
  usage: MediaUsage,
  contentType = 'application/pdf',
): Promise<string> {
  const mediaId = v7();
  await query(
    `INSERT INTO media.assets (id, owner_id, usage, source, status, visibility,
       declared_content_type, declared_size, content_type, size, page_count, quarantine_key,
       moderation_status, files, unattached_since, created_at, updated_at, processed_at)
     VALUES ($1, $2, $3, 'upload', 'ready', 'private', $4, 100, $4, 100, 1, $5, 'none',
       $6::jsonb, now(), now(), now(), now())`,
    [
      mediaId,
      ownerId,
      usage,
      contentType,
      `quarantine/${mediaId}`,
      JSON.stringify({ fileKey: `media/${mediaId}/document.pdf`, variants: {} }),
    ],
  );
  return mediaId;
}

/** Starts or continues the direct conversation with a member over HTTP. */
export async function write(from: Member, toHandle: string, body: string, status = 201) {
  await ensureMinimumProfile(from);
  const response = await from.agent
    .post('/v1/messaging/conversations')
    .set('Idempotency-Key', randomUUID())
    .send({ recipientHandle: toHandle, clientMessageId: `client-${randomUUID()}`, body });
  expect(response.status, JSON.stringify(response.body)).toBe(status);
  return response.body as Message & { code?: string };
}

export interface RealtimeClient {
  socket: Socket;
  received: Map<string, unknown[]>;
  emit<T>(event: string, payload: unknown): Promise<T>;
}

/** A device of the member: a Socket.IO client with its own session. */
export async function device(baseUrl: string, member: Member): Promise<RealtimeClient> {
  const cookie = await signIn(member.agent, member.email);
  const socket = io(`${baseUrl}/`, {
    transports: ['websocket'],
    extraHeaders: { cookie, origin: TEST_WEB_APP_URL },
    reconnection: false,
  });
  const received = new Map<string, unknown[]>();
  socket.onAny((event: string, payload: unknown) => {
    received.set(event, [...(received.get(event) ?? []), payload]);
  });
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', reject);
  });
  return {
    socket,
    received,
    emit: <T>(event: string, payload: unknown) =>
      socket.timeout(10_000).emitWithAck(event, payload) as Promise<T>,
  };
}

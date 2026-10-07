import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Conversation, Introduction, Message, MessagePage } from '@pitchorium/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiTestApp } from './support/api-app';
import { query, truncateAllTables } from './support/database';
import { createMember, type Member } from './support/members';
import {
  connectMembers,
  device,
  handleOf,
  readyMedia,
  type RealtimeClient,
  write,
} from './support/messaging';

type Ack<T> = { ok: true; result: T } | { ok: false; code: string };

/** Messaging (§10.4): conversations, requests, blocks, files, shared posts, introductions. */
describe('messaging', () => {
  let app: NestExpressApplication;
  let baseUrl: string;
  const clients: RealtimeClient[] = [];
  let ama: Member;
  let kofi: Member;
  let awa: Member;
  let amaHandle: string;
  let kofiHandle: string;
  let awaHandle: string;

  const conversations = async (member: Member, box = 'inbox') =>
    (
      (await member.agent.get(`/v1/messaging/conversations?box=${box}`).expect(200)).body as {
        items: Conversation[];
      }
    ).items;

  const send = (member: Member, conversationId: string, body: object, status = 201) =>
    member.agent
      .post(`/v1/messaging/conversations/${conversationId}/messages`)
      .set('Idempotency-Key', randomUUID())
      .send({ clientMessageId: `client-${randomUUID()}`, ...body })
      .expect(status);

  const open = async (member: Member) => {
    const client = await device(baseUrl, member);
    clients.push(client);
    return client;
  };

  beforeAll(async () => {
    ({ app } = await createApiTestApp([], { MESSAGING_REQUESTS_PER_DAY: '2' }));
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    for (const client of clients) client.socket.disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables();
    ama = await createMember(app, 'ama@example.com', { name: 'Ama Owusu' });
    kofi = await createMember(app, 'kofi@example.com', { name: 'Kofi Mensah' });
    awa = await createMember(app, 'awa@example.com', { name: 'Awa Ndiaye' });
    amaHandle = await handleOf(ama);
    kofiHandle = await handleOf(kofi);
    awaHandle = await handleOf(awa);
  });

  it('lets connected members write, read and keep their own state', async () => {
    await connectMembers(ama, kofi);
    const first = await write(ama, kofiHandle, 'Bonjour Kofi');
    expect(first).toMatchObject({ sequence: 1, mine: true, senderHandle: amaHandle });
    const again = await write(ama, kofiHandle, 'Encore moi');
    expect(again).toMatchObject({ conversationId: first.conversationId, sequence: 2 });

    const [inbox] = await conversations(kofi);
    expect(inbox).toMatchObject({
      kind: 'direct',
      requestState: 'none',
      unreadCount: 2,
      canSend: true,
      lastMessage: { body: 'Encore moi', mine: false },
      participants: [{ member: { handle: amaHandle }, lastReadSequence: 2 }],
    });
    await kofi.agent
      .post(`/v1/messaging/conversations/${first.conversationId}/read`)
      .send({ sequence: 2 })
      .expect(200, { sequence: 2 });
    // Archive, mute and mark unread belong to one member.
    const updated = await kofi.agent
      .patch(`/v1/messaging/conversations/${first.conversationId}`)
      .send({ muted: true, unread: true })
      .expect(200);
    expect(updated.body).toMatchObject({ unreadCount: 0, muted: true, markedUnread: true });
    await kofi.agent
      .patch(`/v1/messaging/conversations/${first.conversationId}`)
      .send({ archived: true })
      .expect(200);
    expect(await conversations(kofi)).toHaveLength(0);
    expect(await conversations(kofi, 'archived')).toHaveLength(1);
    // A new message brings it back to the inbox.
    await write(ama, kofiHandle, 'Tu es là ?');
    expect(await conversations(kofi)).toHaveLength(1);
    expect((await conversations(ama))[0]).toMatchObject({ muted: false, archived: false });
  });

  it('turns a first message out of network into a request answered by the recipient', async () => {
    // Ama and Awa share Kofi: second degree, the default policy admits a request.
    await connectMembers(ama, kofi);
    await connectMembers(kofi, awa);
    const unverified = await createMember(app, 'new@example.com', { verified: false });
    expect((await write(unverified, awaHandle, 'Bonjour', 403)).code).toBe(
      'ACCESS_PREREQUISITES_MISSING',
    );

    const request = await write(ama, awaHandle, 'Bonjour Awa, je finance des projets agricoles.');
    expect(await conversations(awa)).toHaveLength(0);
    const [received] = await conversations(awa, 'requests');
    expect(received).toMatchObject({ requestState: 'received', canSend: true });
    expect((await conversations(ama))[0]).toMatchObject({ requestState: 'sent', canSend: false });
    expect((await send(ama, request.conversationId, { body: 'Relance' }, 409)).body.code).toBe(
      'MESSAGING_REQUEST_PENDING',
    );

    await awa.agent
      .post(`/v1/messaging/conversations/${request.conversationId}/accept`)
      .expect(204);
    expect((await conversations(ama))[0]).toMatchObject({ requestState: 'none', canSend: true });
    await send(ama, request.conversationId, { body: 'Merci !' });

    // A decline is silent: the sender still sees a request waiting.
    const outsider = await createMember(app, 'out@example.com', { name: 'Out Sider' });
    await connectMembers(outsider, kofi);
    const declined = await write(outsider, awaHandle, 'Une offre');
    await awa.agent
      .post(`/v1/messaging/conversations/${declined.conversationId}/decline`)
      .expect(204);
    expect(await conversations(awa, 'requests')).toHaveLength(0);
    await awa.agent.get(`/v1/messaging/conversations/${declined.conversationId}`).expect(404);
    expect((await conversations(outsider))[0]).toMatchObject({ requestState: 'sent' });
    expect(
      (await send(outsider, declined.conversationId, { body: 'Relance' }, 409)).body.code,
    ).toBe('MESSAGING_REQUEST_PENDING');

    // The policy of the recipient, and the daily limit of requests (2 in this test).
    await awa.agent.put('/v1/me/messaging/settings').send({ messagePolicy: 'connections_only' });
    const stranger = await createMember(app, 'stranger@example.com', { name: 'Stranger' });
    await connectMembers(stranger, kofi);
    expect((await write(stranger, awaHandle, 'Bonjour', 403)).code).toBe(
      'MESSAGING_RECIPIENT_NOT_ACCEPTING',
    );
    await awa.agent.put('/v1/me/messaging/settings').send({ messagePolicy: 'verified_members' });
    const far = await createMember(app, 'far@example.com', { name: 'Far Away' });
    const other = await createMember(app, 'other@example.com', { name: 'Other One' });
    const third = await createMember(app, 'third@example.com', { name: 'Third One' });
    for (const open of [other, third]) {
      await open.agent.put('/v1/me/messaging/settings').send({ messagePolicy: 'verified_members' });
    }
    await write(far, awaHandle, 'Un');
    await write(far, await handleOf(other), 'Deux');
    expect((await write(far, await handleOf(third), 'Trois', 429)).code).toBe(
      'MESSAGING_REQUEST_LIMIT',
    );
  });

  it('hides the conversations across a block and refuses any message', async () => {
    await connectMembers(ama, kofi);
    const message = await write(ama, kofiHandle, 'Bonjour');
    await kofi.agent.put(`/v1/network/blocks/${amaHandle}`).expect(204);
    expect(await conversations(ama)).toHaveLength(0);
    expect(await conversations(kofi)).toHaveLength(0);
    await send(ama, message.conversationId, { body: 'Toujours là ?' }, 404);
    expect((await write(ama, kofiHandle, 'Bonjour ?', 404)).code).toBe(
      'MESSAGING_RECIPIENT_NOT_FOUND',
    );
  });

  it('serves an attachment to the participants only', async () => {
    await connectMembers(ama, kofi);
    const pdf = await readyMedia(ama.userId, 'message_attachment');
    const conversation = (await write(ama, kofiHandle, 'Le pitch')).conversationId;
    const sent = (await send(ama, conversation, { attachmentIds: [pdf] })).body as Message;
    expect(sent.attachments).toEqual([{ mediaId: pdf, image: null }]);
    await kofi.agent.get(`/v1/media/${pdf}/download-url`).expect(200);
    await awa.agent.get(`/v1/media/${pdf}/download-url`).expect(404);
    // A file of another member cannot be attached.
    const foreign = await readyMedia(awa.userId, 'message_attachment');
    await send(ama, conversation, { attachmentIds: [foreign] }, 404);
    // Deleting leaves a tombstone and frees the file.
    await ama.agent
      .delete(`/v1/messaging/conversations/${conversation}/messages/${sent.id}`)
      .expect(204);
    const page = (
      await kofi.agent.get(`/v1/messaging/conversations/${conversation}/messages`).expect(200)
    ).body as MessagePage;
    expect(page.items.at(-1)).toMatchObject({
      sequence: 2,
      deleted: true,
      body: null,
      attachments: [],
    });
    await kofi.agent.get(`/v1/media/${pdf}/download-url`).expect(404);
  });

  it('shows a shared publication only to a reader in its audience', async () => {
    // Ama publishes for her connections; Kofi shares it with Awa, who is not connected to Ama.
    await connectMembers(ama, kofi);
    await connectMembers(kofi, awa);
    const post = await ama.agent
      .post('/v1/posts')
      .set('Idempotency-Key', randomUUID())
      .send({ text: 'Réservé à mon réseau', visibility: 'connections' })
      .expect(201);
    const shared = await write(kofi, awaHandle, 'Regarde ceci');
    await send(kofi, shared.conversationId, { sharedPostId: post.body.id });
    const read = async (member: Member) =>
      (
        (await member.agent.get(`/v1/messaging/conversations/${shared.conversationId}/messages`))
          .body as MessagePage
      ).items.at(-1)?.sharedPost;
    expect(await read(kofi)).toMatchObject({ postId: post.body.id, post: { id: post.body.id } });
    expect(await read(awa)).toEqual({ postId: post.body.id, post: null });
  });

  it('edits within the window and refuses an edit by another participant', async () => {
    await connectMembers(ama, kofi);
    const message = await write(ama, kofiHandle, 'Brouillon');
    const path = `/v1/messaging/conversations/${message.conversationId}/messages/${message.id}`;
    const edited = await ama.agent.patch(path).send({ body: 'Version finale' }).expect(200);
    expect(edited.body).toMatchObject({ body: 'Version finale', edited: true });
    await kofi.agent.patch(path).send({ body: 'Non' }).expect(403);
    await query(`UPDATE messaging.messages SET created_at = now() - interval '1 hour'`);
    expect((await ama.agent.patch(path).send({ body: 'Trop tard' }).expect(409)).body.code).toBe(
      'MESSAGING_EDIT_WINDOW_CLOSED',
    );
  });

  it('introduces two members: a group opens with the note once both accept', async () => {
    await connectMembers(ama, kofi);
    await connectMembers(ama, awa);
    const proposed = await ama.agent
      .post('/v1/messaging/introductions')
      .set('Idempotency-Key', randomUUID())
      .send({ firstHandle: kofiHandle, secondHandle: awaHandle, note: 'Kofi, voici Awa.' })
      .expect(201);
    const introduction = proposed.body as Introduction;
    expect(introduction).toMatchObject({ role: 'introducer', status: 'pending' });
    await ama.agent.post(`/v1/messaging/introductions/${introduction.id}/accept`).expect(403);
    await kofi.agent.post(`/v1/messaging/introductions/${introduction.id}/accept`).expect(200);
    const done = await awa.agent
      .post(`/v1/messaging/introductions/${introduction.id}/accept`)
      .expect(200);
    expect(done.body).toMatchObject({
      status: 'completed',
      answers: { first: 'accepted', second: 'accepted' },
    });
    const conversationId = (done.body as Introduction).conversationId!;
    const page = (
      await awa.agent.get(`/v1/messaging/conversations/${conversationId}/messages`).expect(200)
    ).body as MessagePage;
    expect(page.items).toEqual([
      expect.objectContaining({
        kind: 'introduction',
        body: 'Kofi, voici Awa.',
        senderHandle: amaHandle,
      }),
    ]);
    // The introducer may leave; the two others keep talking.
    await ama.agent.post(`/v1/messaging/conversations/${conversationId}/leave`).expect(204);
    await send(kofi, conversationId, { body: 'Ravi, Awa !' });
    await ama.agent.get(`/v1/messaging/conversations/${conversationId}`).expect(404);
    expect((await conversations(awa))[0]).toMatchObject({
      kind: 'group',
      participants: expect.arrayContaining([
        expect.objectContaining({
          member: expect.objectContaining({ handle: amaHandle }),
          left: true,
        }),
      ]),
    });
  });

  it('delivers in real time to every device, deduplicates, syncs after a disconnection and reads', async () => {
    await connectMembers(ama, kofi);
    const conversationId = (await write(ama, kofiHandle, 'Premier')).conversationId;
    const amaDevice = await open(ama);
    const kofiLaptop = await open(kofi);
    const kofiPhone = await open(kofi);

    const payload = { conversationId, clientMessageId: 'socket-message-0001', body: 'Par socket' };
    const sent = await amaDevice.emit<Ack<Message>>('messaging:send', payload);
    expect(sent).toMatchObject({ ok: true, result: { sequence: 2, mine: true } });
    // A retry after a lost acknowledgement gives the same message, sent once.
    const retried = await amaDevice.emit<Ack<Message>>('messaging:send', payload);
    expect(retried).toEqual(sent);
    await vi.waitFor(() => {
      for (const client of [kofiLaptop, kofiPhone, amaDevice]) {
        expect(client.received.get('messaging:message')).toHaveLength(1);
      }
    });
    expect(kofiPhone.received.get('messaging:message')?.[0]).toMatchObject({
      message: { sequence: 2, mine: false, body: 'Par socket' },
    });

    // The phone goes offline; two messages later it catches up from its last sequence.
    kofiPhone.socket.disconnect();
    await amaDevice.emit('messaging:send', {
      ...payload,
      clientMessageId: 'socket-message-0002',
      body: 'Trois',
    });
    await amaDevice.emit('messaging:send', {
      ...payload,
      clientMessageId: 'socket-message-0003',
      body: 'Quatre',
    });
    const back = await open(kofi);
    const synced = await back.emit<Ack<MessagePage>>('messaging:sync', {
      conversationId,
      afterSequence: 2,
    });
    expect(synced.ok && synced.result.items.map((m) => m.body)).toEqual(['Trois', 'Quatre']);
    expect(synced.ok && synced.result.lastSequence).toBe(4);

    // Read receipt: the reader's devices and the sender hear of it; typing is relayed.
    const read = await back.emit<Ack<{ sequence: number }>>('messaging:read', {
      conversationId,
      sequence: 4,
    });
    expect(read).toEqual({ ok: true, result: { sequence: 4 } });
    back.socket.emit('messaging:typing', { conversationId });
    await vi.waitFor(() => {
      expect(amaDevice.received.get('messaging:read')).toEqual([
        { conversationId, handle: kofiHandle, mine: false, sequence: 4 },
      ]);
      expect(kofiLaptop.received.get('messaging:read')?.[0]).toMatchObject({ mine: true });
      expect(amaDevice.received.get('messaging:typing')).toEqual([
        { conversationId, handle: kofiHandle },
      ]);
    });
    // A member outside the conversation gets an error code, nothing else.
    const outsider = await open(awa);
    expect(
      await outsider.emit('messaging:send', { ...payload, clientMessageId: 'socket-message-0009' }),
    ).toEqual({ ok: false, code: 'MESSAGING_CONVERSATION_NOT_FOUND' });
  });
});

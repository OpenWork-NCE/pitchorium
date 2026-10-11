import {
  getMessagingControllerListQueryKey,
  getNotificationsControllerCountersQueryKey,
  getNotificationsControllerListQueryKey,
} from '@pitchorium/api-client';
import { SERVER_EVENTS } from '@pitchorium/contracts';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { onRealtime } from './realtime-bus';
import { realtimeHandlers } from './realtime-handlers';

const counters = {
  notifications: 3,
  messages: { unread: 2, conversations: 1 },
  messageRequests: 0,
  invitations: { connections: 1, introductions: 0, projects: 0, organizations: 0 },
};
const conversationId = '0199a0b0-0000-7000-8000-000000000001';

describe('realtime handlers', () => {
  it('write the counters pushed by the api into the cache', () => {
    const client = new QueryClient();
    realtimeHandlers(client)[SERVER_EVENTS.counters]?.({ counters });
    expect(client.getQueryData(getNotificationsControllerCountersQueryKey())).toEqual(counters);
  });

  it('ignore a payload that fails its schema', () => {
    const client = new QueryClient();
    const heard = vi.fn();
    const stop = onRealtime(SERVER_EVENTS.counters, heard);
    realtimeHandlers(client)[SERVER_EVENTS.counters]?.({ counters: { notifications: 'many' } });
    expect(client.getQueryData(getNotificationsControllerCountersQueryKey())).toBeUndefined();
    expect(heard).not.toHaveBeenCalled();
    stop();
  });

  it('give the checked payload to the pages that listen', () => {
    const client = new QueryClient();
    const typing = vi.fn();
    const stop = onRealtime(SERVER_EVENTS.typing, typing);
    realtimeHandlers(client)[SERVER_EVENTS.typing]?.({ conversationId, handle: 'kofi-mensah' });
    expect(typing).toHaveBeenCalledWith({ conversationId, handle: 'kofi-mensah' });
    stop();
  });

  it('read the conversations again on a change, never the notifications under the reader', () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const handlers = realtimeHandlers(client);
    handlers[SERVER_EVENTS.conversation]?.({ conversationId, change: 'created' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: getMessagingControllerListQueryKey() });
    invalidate.mockClear();
    // A read on another device of the member changes the unread counts of the list.
    handlers[SERVER_EVENTS.read]?.({ conversationId, handle: 'ama', mine: true, sequence: 4 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: getMessagingControllerListQueryKey() });
    invalidate.mockClear();
    handlers[SERVER_EVENTS.notification]?.({ notification: { id: 'not a notification' } });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: getNotificationsControllerListQueryKey(),
    });
  });
});

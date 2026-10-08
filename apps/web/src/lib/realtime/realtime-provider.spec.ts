import {
  getMessagingControllerListQueryKey,
  getNotificationsControllerCountersQueryKey,
  getNotificationsControllerListQueryKey,
} from '@pitchorium/api-client';
import { SERVER_EVENTS } from '@pitchorium/contracts';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { realtimeHandlers } from './realtime-provider';

const counters = {
  notifications: 3,
  messages: { unread: 2, conversations: 1 },
  messageRequests: 0,
  invitations: { connections: 1, introductions: 0, projects: 0, organizations: 0 },
};

describe('realtime handlers', () => {
  it('write the counters pushed by the api into the cache', () => {
    const client = new QueryClient();
    realtimeHandlers(client)[SERVER_EVENTS.counters]?.({ counters });
    expect(client.getQueryData(getNotificationsControllerCountersQueryKey())).toEqual(counters);
  });

  it('ignore a payload that fails its schema', () => {
    const client = new QueryClient();
    realtimeHandlers(client)[SERVER_EVENTS.counters]?.({ counters: { notifications: 'many' } });
    expect(client.getQueryData(getNotificationsControllerCountersQueryKey())).toBeUndefined();
  });

  it('only invalidate what a notification or a conversation change makes stale', () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const handlers = realtimeHandlers(client);
    handlers[SERVER_EVENTS.conversation]?.({
      conversationId: '0199a0b0-0000-7000-8000-000000000001',
      change: 'created',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: getMessagingControllerListQueryKey() });
    handlers[SERVER_EVENTS.notification]?.({ notification: { id: 'not a notification' } });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: getNotificationsControllerListQueryKey(),
    });
  });
});

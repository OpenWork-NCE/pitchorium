import { MutationObserver, onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PERSISTED_MUTATIONS,
  PERSISTED_TTL_MS,
  type PersistedRecord,
  type RecordStore,
  registerPersistedMutations,
  restore,
  save,
} from './persisted-mutations';

const react = vi.hoisted(() => vi.fn(() => Promise.resolve({ total: 1 })));
vi.mock('@pitchorium/api-client', () => ({
  postsControllerReact: react,
  postsControllerUnreact: vi.fn(),
  commentsControllerCreate: vi.fn(),
  messagingControllerSend: vi.fn(),
}));

function memoryStore(): RecordStore & { record: PersistedRecord | undefined } {
  return {
    record: undefined,
    get() {
      return Promise.resolve(this.record);
    },
    set(record) {
      this.record = record;
      return Promise.resolve();
    },
    clear() {
      this.record = undefined;
      return Promise.resolve();
    },
  };
}

function client() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  registerPersistedMutations(queryClient);
  return queryClient;
}

/** A mutation started offline: paused, with its variables. */
function startOffline(
  queryClient: QueryClient,
  mutationKey: readonly unknown[],
  variables: unknown,
) {
  const observer = new MutationObserver<unknown, unknown, unknown>(queryClient, { mutationKey });
  void observer.mutate(variables).catch(() => undefined);
}

const REACTION = { input: { postId: 'post-1', type: 'like' }, key: 'intention-1' };

describe('persisted mutations', () => {
  beforeEach(() => onlineManager.setOnline(false));
  afterEach(() => {
    onlineManager.setOnline(true);
    react.mockClear();
  });

  it('keeps the paused mutations of the list only, with the key of their intention', async () => {
    const queryClient = client();
    const store = memoryStore();
    startOffline(queryClient, PERSISTED_MUTATIONS.reaction.mutationKey, REACTION);
    // Not in the list (the shell marks the notifications read): never written to the device.
    queryClient.setMutationDefaults(['notifications', 'read-all'], {
      mutationFn: () => Promise.resolve(),
    });
    startOffline(queryClient, ['notifications', 'read-all'], { input: undefined, key: 'k' });
    await vi.waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(2));
    await save(queryClient, store, 'member-1', 1_000);
    expect(store.record?.memberId).toBe('member-1');
    expect(store.record?.state.mutations.map((mutation) => mutation.mutationKey)).toEqual([
      ['content', 'reaction'],
    ]);
    expect(store.record?.state.mutations[0]?.state.variables).toEqual(REACTION);
  });

  it('replays a kept action once online, with the same key, then keeps nothing', async () => {
    const before = client();
    const store = memoryStore();
    startOffline(before, PERSISTED_MUTATIONS.reaction.mutationKey, REACTION);
    await vi.waitFor(() => expect(before.getMutationCache().getAll()).toHaveLength(1));
    await save(before, store, 'member-1');

    // The tab closed; another opens online.
    onlineManager.setOnline(true);
    const after = client();
    expect(await restore(after, store, 'member-1')).toBe(1);
    await after.resumePausedMutations();
    expect(react).toHaveBeenCalledOnce();
    expect(react).toHaveBeenCalledWith(
      'post-1',
      { type: 'like' },
      {
        headers: { 'Idempotency-Key': 'intention-1' },
      },
    );
    await save(after, store, 'member-1');
    expect(store.record).toBeUndefined();
  });

  it('erases what another member or an expired session left on the device', async () => {
    const queryClient = client();
    const store = memoryStore();
    startOffline(queryClient, PERSISTED_MUTATIONS.reaction.mutationKey, REACTION);
    await vi.waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(1));
    await save(queryClient, store, 'member-1');
    expect(await restore(client(), store, 'member-2')).toBe(0);
    expect(store.record).toBeUndefined();

    await save(queryClient, store, 'member-1');
    expect(await restore(client(), store, 'member-1', Date.now() + PERSISTED_TTL_MS + 1)).toBe(0);
    expect(store.record).toBeUndefined();
  });
});

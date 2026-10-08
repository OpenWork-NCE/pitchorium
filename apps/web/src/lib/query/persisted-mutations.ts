import {
  commentsControllerCreate,
  type CreateCommentDto,
  messagingControllerSend,
  postsControllerReact,
  postsControllerUnreact,
  type SendMessageDto,
  type SetReactionDto,
} from '@pitchorium/api-client';
import {
  type DehydratedState,
  dehydrate,
  hydrate,
  type Mutation,
  type MutationKey,
  type QueryClient,
} from '@tanstack/react-query';

/**
 * Writes made offline that survive the closing of the tab (ADR 0102): only the paused mutations
 * listed here (a message, a reaction, a comment), with the Idempotency-Key of their intention,
 * are kept in IndexedDB, for the member who made them; they are replayed when the member space
 * opens again online, then forgotten. Never anything of the authentication or of a payment.
 */

/** Variables of a persisted mutation: what the member did and the key of that intention. */
export interface Intent<Input> {
  input: Input;
  key: string;
}

export interface ReactionInput {
  postId: string;
  /** The reaction set, null to take it back. */
  type: SetReactionDto['type'] | null;
}

export interface CommentInput {
  postId: string;
  body: CreateCommentDto;
}

export interface MessageInput {
  conversationId: string;
  body: SendMessageDto;
}

const headers = (key: string) => ({ headers: { 'Idempotency-Key': key } });

/**
 * The persisted mutations, by key: their call of the api, registered as the defaults of the
 * client, so that a mutation restored after a reload (it has no function of its own) can run.
 */
export const PERSISTED_MUTATIONS = {
  reaction: {
    mutationKey: ['content', 'reaction'],
    mutationFn: ({ input, key }: Intent<ReactionInput>) =>
      input.type
        ? postsControllerReact(input.postId, { type: input.type }, headers(key))
        : postsControllerUnreact(input.postId, headers(key)),
  },
  comment: {
    mutationKey: ['content', 'comment'],
    mutationFn: ({ input, key }: Intent<CommentInput>) =>
      commentsControllerCreate(input.postId, input.body, headers(key)),
  },
  message: {
    mutationKey: ['messaging', 'send'],
    mutationFn: ({ input, key }: Intent<MessageInput>) =>
      messagingControllerSend(input.conversationId, input.body, headers(key)),
  },
} as const;

/**
 * Lifetime of a kept action: the api remembers an Idempotency-Key 24 hours; replayed later, an
 * action could apply twice. An older one is dropped.
 */
export const PERSISTED_TTL_MS = 24 * 3_600_000;

const PERSISTED_KEYS = new Set(
  Object.values(PERSISTED_MUTATIONS).map(({ mutationKey }) => JSON.stringify(mutationKey)),
);

/** True for a mutation of the list (the only ones ever written to the device). */
export function isPersisted(mutationKey: MutationKey | undefined): boolean {
  return mutationKey !== undefined && PERSISTED_KEYS.has(JSON.stringify(mutationKey));
}

/** What is kept on the device: the paused mutations of the list, for one member. */
export interface PersistedRecord {
  memberId: string;
  savedAt: number;
  state: DehydratedState;
}

/** Storage of the record (IndexedDB in the browser, a map in the tests). */
export interface RecordStore {
  get(): Promise<PersistedRecord | undefined>;
  set(record: PersistedRecord): Promise<void>;
  clear(): Promise<void>;
}

/** Registers the call of every persisted mutation as the defaults of its key. */
export function registerPersistedMutations(queryClient: QueryClient): void {
  for (const { mutationKey, mutationFn } of Object.values(PERSISTED_MUTATIONS)) {
    queryClient.setMutationDefaults(mutationKey, {
      mutationFn: mutationFn as (variables: unknown) => Promise<unknown>,
    });
  }
}

/** The paused mutations of the list, nothing else (no query, no other mutation). */
export function snapshot(queryClient: QueryClient): DehydratedState {
  return dehydrate(queryClient, {
    shouldDehydrateQuery: () => false,
    shouldDehydrateMutation: (mutation: Mutation) =>
      mutation.state.isPaused && isPersisted(mutation.options.mutationKey),
  });
}

/**
 * Restores the actions kept for this member and less than PERSISTED_TTL_MS old, as paused
 * mutations; the record of another member or an expired one is erased. Returns how many came
 * back; the caller resumes them once online.
 */
export async function restore(
  queryClient: QueryClient,
  store: RecordStore,
  memberId: string,
  now = Date.now(),
): Promise<number> {
  const record = await store.get();
  if (!record) return 0;
  const fresh = record.memberId === memberId && now - record.savedAt < PERSISTED_TTL_MS;
  const mutations = fresh
    ? record.state.mutations.filter(
        (mutation) =>
          isPersisted(mutation.mutationKey) && now - mutation.state.submittedAt < PERSISTED_TTL_MS,
      )
    : [];
  if (mutations.length === 0) {
    await store.clear();
    return 0;
  }
  hydrate(queryClient, { mutations, queries: [] });
  return mutations.length;
}

/** Writes the paused mutations of the list, or erases the record when none is left. */
export async function save(
  queryClient: QueryClient,
  store: RecordStore,
  memberId: string,
  now = Date.now(),
): Promise<void> {
  const state = snapshot(queryClient);
  if (state.mutations.length === 0) await store.clear();
  else await store.set({ memberId, savedAt: now, state });
}

const DATABASE = 'pitchorium';
const STORE = 'paused-mutations';
const RECORD = 'record';

function request<T>(open: (store: IDBObjectStore) => IDBRequest<T>, mode: IDBTransactionMode) {
  return new Promise<T>((resolve, reject) => {
    const opening = indexedDB.open(DATABASE, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE);
    opening.onerror = () => reject(opening.error ?? new Error('IndexedDB unavailable'));
    opening.onsuccess = () => {
      const database = opening.result;
      const transaction = database.transaction(STORE, mode);
      const result = open(transaction.objectStore(STORE));
      transaction.oncomplete = () => {
        database.close();
        resolve(result.result);
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error('IndexedDB transaction failed'));
      };
    };
  });
}

/** The record in IndexedDB; a browser without it (private mode) keeps nothing. */
export const indexedDbStore: RecordStore = {
  get: () =>
    typeof indexedDB === 'undefined'
      ? Promise.resolve(undefined)
      : request<PersistedRecord | undefined>(
          (store) => store.get(RECORD) as IDBRequest<PersistedRecord | undefined>,
          'readonly',
        ).catch(() => undefined),
  set: (record) =>
    typeof indexedDB === 'undefined'
      ? Promise.resolve()
      : request((store) => store.put(record, RECORD), 'readwrite').then(
          () => undefined,
          () => undefined,
        ),
  clear: () =>
    typeof indexedDB === 'undefined'
      ? Promise.resolve()
      : request((store) => store.delete(RECORD), 'readwrite').then(
          () => undefined,
          () => undefined,
        ),
};

/** Forgets the actions kept on the device (sign-out). */
export function clearPersistedMutations(): Promise<void> {
  return indexedDbStore.clear();
}

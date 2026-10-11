/**
 * The message being written in each conversation, kept on the device (ADR 0147): found again
 * when the conversation opens, erased once sent and at sign-out. Only for its member, in
 * IndexedDB, never sent anywhere; text only (a file is chosen again). A browser without
 * IndexedDB (private mode) keeps nothing.
 */

export interface StoredMessageDraft {
  memberId: string;
  savedAt: number;
  text: string;
}

/** Storage of the drafts by conversation (IndexedDB in the browser, a map in the tests). */
export interface MessageDraftStore {
  get(conversationId: string): Promise<StoredMessageDraft | undefined>;
  set(conversationId: string, record: StoredMessageDraft): Promise<void>;
  delete(conversationId: string): Promise<void>;
  clear(): Promise<void>;
}

/** A draft older than this is dropped (provisional, docs/open-questions.md). */
export const MESSAGE_DRAFT_TTL_MS = 30 * 24 * 3_600_000;

/** The draft of this member in the conversation; another member's or an old one is erased. */
export async function readMessageDraft(
  store: MessageDraftStore,
  memberId: string,
  conversationId: string,
  now = Date.now(),
): Promise<string> {
  const record = await store.get(conversationId);
  if (!record) return '';
  if (record.memberId !== memberId || now - record.savedAt > MESSAGE_DRAFT_TTL_MS) {
    await store.delete(conversationId);
    return '';
  }
  return record.text;
}

/** Keeps the draft, or erases it when nothing is written. */
export async function writeMessageDraft(
  store: MessageDraftStore,
  memberId: string,
  conversationId: string,
  text: string,
  now = Date.now(),
): Promise<void> {
  if (text.trim() === '') await store.delete(conversationId);
  else await store.set(conversationId, { memberId, savedAt: now, text });
}

const DATABASE = 'pitchorium-message-drafts';
const STORE = 'drafts';

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

const available = () => typeof indexedDB !== 'undefined';
const ignore = () => undefined;

export const indexedDbMessageDraftStore: MessageDraftStore = {
  get: (conversationId) =>
    available()
      ? request<StoredMessageDraft | undefined>(
          (store) => store.get(conversationId) as IDBRequest<StoredMessageDraft | undefined>,
          'readonly',
        ).catch(ignore)
      : Promise.resolve(undefined),
  set: (conversationId, record) =>
    available()
      ? request((store) => store.put(record, conversationId), 'readwrite').then(ignore, ignore)
      : Promise.resolve(),
  delete: (conversationId) =>
    available()
      ? request((store) => store.delete(conversationId), 'readwrite').then(ignore, ignore)
      : Promise.resolve(),
  clear: () =>
    available()
      ? request((store) => store.clear(), 'readwrite').then(ignore, ignore)
      : Promise.resolve(),
};

/** Forgets every draft of the device (sign-out). */
export function clearMessageDrafts(): Promise<void> {
  return indexedDbMessageDraftStore.clear();
}

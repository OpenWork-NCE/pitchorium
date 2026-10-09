/**
 * The publication being written, kept on the device while it is written (ADR 0122): found again
 * when the composer opens, erased once published and at sign-out. Only for its member, in
 * IndexedDB, never sent anywhere; a browser without IndexedDB (private mode) keeps nothing.
 */

/** What a draft holds: the document of the editor and the choices of the composer. */
export interface ComposerDraft {
  /** Document of the editor (Tiptap JSON). */
  document: unknown;
  visibility: 'public' | 'members' | 'connections';
  /** Declared language; null to let the api detect it. */
  language: string | null;
  /** Images already sent, in their order, with their text alternative. */
  images: { mediaId: string; alt: string }[];
  /** PDF already sent, with its title. */
  pdf: { mediaId: string; title: string } | null;
  /** Link of the preview, and the preview asked for it. */
  link: { url: string; previewId: string | null } | null;
  projectId: string | null;
}

export interface StoredDraft {
  memberId: string;
  savedAt: number;
  draft: ComposerDraft;
}

/** Storage of the draft (IndexedDB in the browser, a map in the tests). */
export interface DraftStore {
  get(): Promise<StoredDraft | undefined>;
  set(record: StoredDraft): Promise<void>;
  clear(): Promise<void>;
}

/** Media of a draft older than this are gone (orphans cleaned by the media module, 24 hours). */
export const DRAFT_MEDIA_TTL_MS = 20 * 3_600_000;

/** The draft of this member, its media dropped when too old; another member's is erased. */
export async function readDraft(
  store: DraftStore,
  memberId: string,
  now = Date.now(),
): Promise<ComposerDraft | null> {
  const record = await store.get();
  if (!record) return null;
  if (record.memberId !== memberId) {
    await store.clear();
    return null;
  }
  if (now - record.savedAt < DRAFT_MEDIA_TTL_MS) return record.draft;
  return { ...record.draft, images: [], pdf: null };
}

/** Keeps the draft, or erases it when nothing is written nor attached. */
export async function writeDraft(
  store: DraftStore,
  memberId: string,
  draft: ComposerDraft,
  isEmpty: boolean,
  now = Date.now(),
): Promise<void> {
  if (isEmpty) await store.clear();
  else await store.set({ memberId, savedAt: now, draft });
}

const DATABASE = 'pitchorium-drafts';
const STORE = 'composer';
const RECORD = 'draft';

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

export const indexedDbDraftStore: DraftStore = {
  get: () =>
    available()
      ? request<StoredDraft | undefined>(
          (store) => store.get(RECORD) as IDBRequest<StoredDraft | undefined>,
          'readonly',
        ).catch(() => undefined)
      : Promise.resolve(undefined),
  set: (record) =>
    available()
      ? request((store) => store.put(record, RECORD), 'readwrite').then(
          () => undefined,
          () => undefined,
        )
      : Promise.resolve(),
  clear: () =>
    available()
      ? request((store) => store.delete(RECORD), 'readwrite').then(
          () => undefined,
          () => undefined,
        )
      : Promise.resolve(),
};

/** Forgets the draft of the device (sign-out). */
export function clearComposerDraft(): Promise<void> {
  return indexedDbDraftStore.clear();
}

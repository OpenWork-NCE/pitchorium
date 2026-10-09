import { describe, expect, it } from 'vitest';
import {
  type ComposerDraft,
  DRAFT_MEDIA_TTL_MS,
  type DraftStore,
  readDraft,
  type StoredDraft,
  writeDraft,
} from './composer-drafts';

function memoryStore(): DraftStore & { record: StoredDraft | undefined } {
  const store = {
    record: undefined as StoredDraft | undefined,
    get: () => Promise.resolve(store.record),
    set: (record: StoredDraft) => {
      store.record = record;
      return Promise.resolve();
    },
    clear: () => {
      store.record = undefined;
      return Promise.resolve();
    },
  };
  return store;
}

const draft: ComposerDraft = {
  document: { type: 'doc', content: [] },
  visibility: 'members',
  language: null,
  images: [{ mediaId: '0198a0f0-0000-7000-8000-000000000001', alt: 'Une parcelle' }],
  pdf: null,
  link: { url: 'https://sahel.example', previewId: null },
  projectId: null,
};

describe('draft of the composer', () => {
  it('finds the draft of its member again', async () => {
    const store = memoryStore();
    await writeDraft(store, 'ama', draft, false, 1000);
    expect(await readDraft(store, 'ama', 2000)).toEqual(draft);
  });

  it('erases the draft of another member, and an empty draft', async () => {
    const store = memoryStore();
    await writeDraft(store, 'ama', draft, false);
    expect(await readDraft(store, 'kofi')).toBeNull();
    expect(store.record).toBeUndefined();
    await writeDraft(store, 'ama', draft, false);
    await writeDraft(store, 'ama', draft, true);
    expect(store.record).toBeUndefined();
  });

  it('drops the files of an old draft, whose media are gone, and keeps its text', async () => {
    const store = memoryStore();
    await writeDraft(store, 'ama', draft, false, 0);
    const old = await readDraft(store, 'ama', DRAFT_MEDIA_TTL_MS + 1);
    expect(old).toMatchObject({ images: [], pdf: null, link: draft.link });
  });
});

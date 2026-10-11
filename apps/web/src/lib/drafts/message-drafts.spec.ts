import { describe, expect, it } from 'vitest';
import {
  MESSAGE_DRAFT_TTL_MS,
  type MessageDraftStore,
  readMessageDraft,
  type StoredMessageDraft,
  writeMessageDraft,
} from './message-drafts';

function memoryStore(): MessageDraftStore & { records: Map<string, StoredMessageDraft> } {
  const records = new Map<string, StoredMessageDraft>();
  return {
    records,
    get: (id) => Promise.resolve(records.get(id)),
    set: (id, record) => {
      records.set(id, record);
      return Promise.resolve();
    },
    delete: (id) => {
      records.delete(id);
      return Promise.resolve();
    },
    clear: () => {
      records.clear();
      return Promise.resolve();
    },
  };
}

describe('message drafts', () => {
  it('keep one draft per conversation for its member', async () => {
    const store = memoryStore();
    await writeMessageDraft(store, 'ama', 'first', 'Bonjour Kofi', 1_000);
    await writeMessageDraft(store, 'ama', 'second', 'Merci Awa', 1_000);
    expect(await readMessageDraft(store, 'ama', 'first', 2_000)).toBe('Bonjour Kofi');
    expect(await readMessageDraft(store, 'ama', 'second', 2_000)).toBe('Merci Awa');
    expect(await readMessageDraft(store, 'ama', 'third', 2_000)).toBe('');
  });

  it('erase a draft emptied, sent, of another member or too old', async () => {
    const store = memoryStore();
    await writeMessageDraft(store, 'ama', 'first', 'Bonjour', 1_000);
    await writeMessageDraft(store, 'ama', 'first', '   ', 1_500);
    expect(store.records.has('first')).toBe(false);

    await writeMessageDraft(store, 'ama', 'first', 'Bonjour', 1_000);
    expect(await readMessageDraft(store, 'kofi', 'first', 2_000)).toBe('');
    expect(store.records.has('first')).toBe(false);

    await writeMessageDraft(store, 'ama', 'first', 'Bonjour', 1_000);
    expect(await readMessageDraft(store, 'ama', 'first', 1_000 + MESSAGE_DRAFT_TTL_MS + 1)).toBe(
      '',
    );
  });

  it('forget every draft at sign-out', async () => {
    const store = memoryStore();
    await writeMessageDraft(store, 'ama', 'first', 'Un', 1_000);
    await writeMessageDraft(store, 'ama', 'second', 'Deux', 1_000);
    await store.clear();
    expect(store.records.size).toBe(0);
  });
});

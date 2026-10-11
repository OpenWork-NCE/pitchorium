'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadImageCompression } from '@/features/content';
import { loadUpload } from '@/features/media';
import { MESSAGING_LIMITS } from '../lib/limits';

/** Types a message accepts (usage `message_attachment` of the media module). */
export const ATTACHMENT_TYPES = 'image/jpeg,image/png,image/webp,application/pdf';

export interface Attachment {
  id: string;
  name: string;
  kind: 'image' | 'pdf';
  previewUrl: string | null;
  state: 'compressing' | 'sending' | 'checking' | 'ready' | 'rejected' | 'failed';
  progress: number;
  mediaId: string | null;
  /** Code of the refusal of the media module (`reference.mediaRejectionReasons`). */
  reason: string | null;
  /** Text alternative of an image, title of a PDF (the name of the file by default). */
  text: string;
  file: File;
}

/**
 * The files of a message (§10.4): photos made lighter in the browser as for a publication
 * (ADR 0120), then each sent privately through the media module (readable by the participants
 * only), checked by the worker, `ready` or refused with its reason; five at most.
 */
export function useAttachments() {
  const [items, setItems] = useState<Attachment[]>([]);
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const patch = useCallback(
    (id: string, change: Partial<Attachment>) =>
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...change } : item)),
      ),
    [],
  );

  const upload = useCallback(
    async (item: Attachment) => {
      patch(item.id, { state: item.kind === 'image' ? 'compressing' : 'sending', reason: null });
      // The compression and the upload load with the first file (never with the page).
      const [{ compressImage }, { MediaRejectedError, uploadMedia }] = await Promise.all([
        loadImageCompression(),
        loadUpload(),
      ]);
      try {
        const file = item.kind === 'image' ? await compressImage(item.file) : item.file;
        const mediaId = await uploadMedia(file, 'message_attachment', (step) =>
          patch(
            item.id,
            step.step === 'sending'
              ? { state: 'sending', progress: step.progress }
              : { state: 'checking' },
          ),
        );
        patch(item.id, { state: 'ready', mediaId });
      } catch (error) {
        patch(
          item.id,
          error instanceof MediaRejectedError
            ? { state: 'rejected', reason: error.reason }
            : { state: 'failed' },
        );
      }
    },
    [patch],
  );

  const add = useCallback(
    (files: readonly File[]) => {
      const room = MESSAGING_LIMITS.attachments - items.length;
      const added = files.slice(0, Math.max(0, room)).map((file): Attachment => {
        const image = file.type.startsWith('image/');
        const previewUrl = image ? URL.createObjectURL(file) : null;
        if (previewUrl) urls.current.add(previewUrl);
        return {
          id: crypto.randomUUID(),
          name: file.name,
          kind: image ? 'image' : 'pdf',
          previewUrl,
          state: 'compressing',
          progress: 0,
          mediaId: null,
          reason: null,
          text: image
            ? ''
            : file.name.replace(/\.pdf$/i, '').slice(0, MESSAGING_LIMITS.attachmentText),
          file,
        };
      });
      setItems((current) => [...current, ...added]);
      for (const item of added) void upload(item);
      return files.length - added.length;
    },
    [items.length, upload],
  );

  return {
    items,
    add,
    retry: (id: string) => {
      const item = items.find((candidate) => candidate.id === id);
      if (item) void upload(item);
    },
    remove: (id: string) => setItems((current) => current.filter((item) => item.id !== id)),
    setText: (id: string, text: string) => patch(id, { text }),
    clear: () => setItems([]),
    pending: items.some((item) => !['ready', 'rejected', 'failed'].includes(item.state)),
    ready: items.filter((item) => item.state === 'ready'),
  };
}

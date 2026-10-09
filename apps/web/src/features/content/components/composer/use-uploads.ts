'use client';

import type { MediaUsage } from '@pitchorium/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MediaRejectedError, uploadMedia } from '@/features/media';
import { compressImage } from '../../lib/image-compression';

/** A file of the composer and where it stands. */
export interface UploadItem {
  /** Key of the item in the composer (a file sent twice keeps it). */
  id: string;
  name: string;
  /** Local preview of an image (object URL), or its variant once restored from a draft. */
  previewUrl: string | null;
  state: 'compressing' | 'sending' | 'checking' | 'ready' | 'rejected' | 'failed';
  /** Share sent, 0 to 1, while `sending`. */
  progress: number;
  mediaId: string | null;
  /** Code of the refusal of the media module (`reference.mediaRejectionReasons`). */
  reason: string | null;
  /** Text alternative of an image; title of a document. */
  text: string;
  file: File | null;
}

/**
 * The files of the composer: photos made lighter first (ADR 0120), then each sent through the
 * media module with its progress, checked by the worker, `ready` or refused with its reason; a
 * failed one is sent again on demand. The order of the list is the order of the publication.
 */
export function useUploads(usage: MediaUsage, initial: UploadItem[] = []) {
  const [items, setItems] = useState<UploadItem[]>(initial);
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const patch = useCallback(
    (id: string, change: Partial<UploadItem>) =>
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...change } : item)),
      ),
    [],
  );

  const send = useCallback(
    async (id: string, original: File) => {
      patch(id, {
        state: usage === 'post_image' ? 'compressing' : 'sending',
        progress: 0,
        reason: null,
      });
      const file = usage === 'post_image' ? await compressImage(original) : original;
      try {
        const mediaId = await uploadMedia(file, usage, (step) =>
          patch(
            id,
            step.step === 'sending'
              ? { state: 'sending', progress: step.progress }
              : { state: 'checking' },
          ),
        );
        patch(id, { state: 'ready', mediaId });
      } catch (error) {
        patch(
          id,
          error instanceof MediaRejectedError
            ? { state: 'rejected', reason: error.reason }
            : { state: 'failed' },
        );
      }
    },
    [patch, usage],
  );

  const add = useCallback(
    (files: readonly File[], defaultText: (file: File) => string = () => '') => {
      const added = files.map((file): UploadItem => {
        const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
        if (previewUrl) urls.current.add(previewUrl);
        return {
          id: crypto.randomUUID(),
          name: file.name,
          previewUrl,
          state: 'compressing',
          progress: 0,
          mediaId: null,
          reason: null,
          text: defaultText(file),
          file,
        };
      });
      setItems((current) => [...current, ...added]);
      for (const item of added) void send(item.id, item.file!);
    },
    [send],
  );

  const retry = useCallback(
    (id: string) => {
      const item = items.find((candidate) => candidate.id === id);
      if (item?.file) void send(id, item.file);
    },
    [items, send],
  );

  return {
    items,
    add,
    retry,
    remove: (id: string) => setItems((current) => current.filter((item) => item.id !== id)),
    setText: (id: string, text: string) => patch(id, { text }),
    move: (from: number, to: number) =>
      setItems((current) => {
        if (to < 0 || to >= current.length) return current;
        const next = [...current];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved!);
        return next;
      }),
    reset: (next: UploadItem[]) => setItems(next),
    pending: items.some((item) => !['ready', 'rejected', 'failed'].includes(item.state)),
  };
}

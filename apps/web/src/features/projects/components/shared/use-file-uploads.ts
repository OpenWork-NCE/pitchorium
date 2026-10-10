'use client';

import type { MediaUsage } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { FileDropItem } from '@/components/ui';
import { MediaRejectedError, uploadMedia } from '@/features/media';

/** A file sent through the media module, and where it stands. */
export type UploadedFile = FileDropItem & { mediaId?: string; file?: File };

/**
 * Files of a form of a project (documents, attachments of an expression of interest): each sent
 * through the media module with its progress and the checks of the worker, refused with its
 * reason, sent again on demand; at most `max`. `initial`: files already attached (ready).
 */
export function useFileUploads(usage: MediaUsage, max: number, initial: UploadedFile[] = []) {
  const t = useTranslations('web.projects.files');
  const rejections = useTranslations('reference.mediaRejectionReasons');
  const [items, setItems] = useState<UploadedFile[]>(initial);

  const update = useCallback(
    (id: string, patch: Partial<UploadedFile>) =>
      setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item))),
    [],
  );

  const send = useCallback(
    async (item: UploadedFile) => {
      if (!item.file) return;
      try {
        const mediaId = await uploadMedia(item.file, usage, (step) =>
          update(
            item.id,
            step.step === 'sending'
              ? { state: 'uploading', progress: step.progress }
              : { state: 'processing', progress: undefined },
          ),
        );
        update(item.id, { state: 'ready', mediaId });
      } catch (error) {
        const reason = error instanceof MediaRejectedError ? error.reason : null;
        update(item.id, {
          state: 'rejected',
          reason:
            reason && rejections.has(reason as never)
              ? rejections(reason as never)
              : t('uploadFailed'),
        });
      }
    },
    [usage, update, rejections, t],
  );

  const add = (files: File[]) => {
    const room = Math.max(0, max - items.length);
    const added = files.slice(0, room).map((file): UploadedFile => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      state: 'pending',
      file,
    }));
    setItems((current) => [...current, ...added]);
    for (const item of added) void send(item);
  };

  return {
    items,
    add,
    remove: (id: string) => setItems((current) => current.filter((item) => item.id !== id)),
    retry: (id: string) => {
      const item = items.find((candidate) => candidate.id === id);
      if (item) void send(item);
    },
    ready: items.flatMap((item) => (item.state === 'ready' && item.mediaId ? [item.mediaId] : [])),
    uploading: items.some((item) => item.state === 'uploading' || item.state === 'processing'),
    full: items.length >= max,
    reset: () => setItems([]),
  };
}

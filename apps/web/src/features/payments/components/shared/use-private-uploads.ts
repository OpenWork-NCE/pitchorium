'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import type { FileDropItem } from '@/components/ui';
import { MediaRejectedError, uploadMedia } from '@/features/media';

/** A private document sent through the media module, and where it stands. */
type UploadedFile = FileDropItem & { mediaId?: string; file?: File };

/** What a private document of the payments may be (media module, `verification_document`). */
export const PRIVATE_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/**
 * Private documents of the payments (proofs of an off-platform contribution, identity documents
 * of the KYC): each sent with its progress and the checks of the worker (antivirus, real type),
 * refused with its reason, sent again on demand; at most `max`. Read by their parties and the
 * administrators only (media access rules registered by the payments module).
 */
export function usePrivateUploads(max: number) {
  const t = useTranslations('web.payments.files');
  const rejections = useTranslations('reference.mediaRejectionReasons');
  const [items, setItems] = useState<UploadedFile[]>([]);

  const update = useCallback(
    (id: string, patch: Partial<UploadedFile>) =>
      setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item))),
    [],
  );

  const send = useCallback(
    async (item: UploadedFile) => {
      if (!item.file) return;
      try {
        const mediaId = await uploadMedia(item.file, 'verification_document', (step) =>
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
    [update, rejections, t],
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

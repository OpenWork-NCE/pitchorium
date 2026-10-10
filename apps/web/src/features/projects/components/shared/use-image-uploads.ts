'use client';

import type { MediaUsage, ProjectImage } from '@pitchorium/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { compressImage } from '@/features/content';
import { MediaRejectedError, uploadMedia } from '@/features/media';

/** An image of a project being edited, and where its sending stands. */
export interface ImageItem {
  id: string;
  name: string;
  /** A preview: the variant of an image already there, an object URL of a new one. */
  previewUrl: string | null;
  state: 'compressing' | 'sending' | 'checking' | 'ready' | 'rejected' | 'failed';
  progress: number;
  mediaId: string | null;
  /** Code of the refusal of the media module (`reference.mediaRejectionReasons`). */
  reason: string | null;
  alt: string;
  file: File | null;
}

/** The images already attached, ready, with their text alternatives. */
export function itemsOf(images: readonly ProjectImage[]): ImageItem[] {
  return images.map((image) => ({
    id: image.mediaId,
    name: image.mediaId,
    previewUrl: image.variants.medium?.webp ?? image.url,
    state: 'ready',
    progress: 1,
    mediaId: image.mediaId,
    reason: null,
    alt: image.alt ?? '',
    file: null,
  }));
}

/**
 * Images of the gallery of a project or of an update (§11.1, §11.3), as for a publication:
 * made lighter in the browser (ADR 0120), sent through the media module with their progress,
 * checked, refused with their reason, sent again on demand, each with its text alternative, in
 * the order of the list.
 */
export function useImageUploads(usage: MediaUsage, max: number, initial: ImageItem[] = []) {
  const [items, setItems] = useState<ImageItem[]>(initial);
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const patch = useCallback(
    (id: string, change: Partial<ImageItem>) =>
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...change } : item)),
      ),
    [],
  );

  const send = useCallback(
    async (id: string, original: File) => {
      patch(id, { state: 'compressing', progress: 0, reason: null });
      const file = await compressImage(original);
      try {
        const mediaId = await uploadMedia(file, usage, (step) =>
          patch(
            id,
            step.step === 'sending'
              ? { state: 'sending', progress: step.progress }
              : { state: 'checking' },
          ),
        );
        patch(id, { state: 'ready', mediaId, progress: 1 });
      } catch (error) {
        patch(id, {
          state: error instanceof MediaRejectedError ? 'rejected' : 'failed',
          reason: error instanceof MediaRejectedError ? error.reason : null,
        });
      }
    },
    [patch, usage],
  );

  const add = (files: File[]) => {
    const room = Math.max(0, max - items.length);
    const added = files.slice(0, room).map((file): ImageItem => {
      const previewUrl = URL.createObjectURL(file);
      urls.current.add(previewUrl);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        previewUrl,
        state: 'compressing',
        progress: 0,
        mediaId: null,
        reason: null,
        alt: '',
        file,
      };
    });
    setItems((current) => [...current, ...added]);
    for (const item of added) if (item.file) void send(item.id, item.file);
  };

  const move = (from: number, to: number) =>
    setItems((current) => {
      if (to < 0 || to >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item!);
      return next;
    });

  return {
    items,
    add,
    move,
    remove: (id: string) => setItems((current) => current.filter((item) => item.id !== id)),
    retry: (id: string) => {
      const item = items.find((candidate) => candidate.id === id);
      if (item?.file) void send(item.id, item.file);
    },
    setAlt: (id: string, alt: string) => patch(id, { alt }),
    reset: () => setItems([]),
    ready: items.filter((item) => item.state === 'ready' && item.mediaId),
    busy: items.some((item) => ['compressing', 'sending', 'checking'].includes(item.state)),
    full: items.length >= max,
  };
}

/** Text alternatives by media id, as the api takes them (empty ones left out). */
export function altsOf(items: readonly ImageItem[]): Record<string, string> {
  return Object.fromEntries(
    items.flatMap((item) =>
      item.mediaId && item.alt.trim() ? [[item.mediaId, item.alt.trim()]] : [],
    ),
  );
}

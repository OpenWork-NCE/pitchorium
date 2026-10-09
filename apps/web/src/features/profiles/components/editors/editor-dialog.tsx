'use client';

import type { ReactNode } from 'react';
import { Dialog, DialogContent } from '@/components/ui';

/** Dialog of an editor of the profile: a sheet from the bottom on a phone (Dialog). */
export function EditorDialog({
  title,
  description,
  onClose,
  size = 'md',
  children,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={title} description={description} size={size}>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** A text left empty is absent: null for the api, which clears it (patterns.md). */
export const orNull = (value: string | null | undefined): string | null =>
  value === undefined || value === null || value.trim() === '' ? null : value;

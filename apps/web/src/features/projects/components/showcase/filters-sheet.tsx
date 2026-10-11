'use client';

import type { ReactNode } from 'react';
import { Button, Sheet, SheetClose, SheetContent } from '@/components/ui';

/**
 * The sheet of the filters of the showcase on a phone, loaded at its first opening: the dialog
 * code stays out of the first load of the showcase (ADR 0094).
 */
export default function FiltersSheet({
  open,
  onOpenChange,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={title}>
        {children}
        <SheetClose asChild>
          <Button type="button" className="mt-auto">
            {closeLabel}
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}

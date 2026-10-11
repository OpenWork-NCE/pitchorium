'use client';

import { SearchPalette, type PaletteProps } from '@/features/discovery';
import { useQuickActions } from './quick-actions';

/**
 * The palette of the member space: the search of a member and the quick actions of the shell,
 * loaded together on demand with their icons (FRONT 7, A2: none of it in the first load).
 */
export function MemberPalette({ open, onOpenChange }: PaletteProps) {
  const actions = useQuickActions();
  return <SearchPalette open={open} onOpenChange={onOpenChange} actions={actions()} signedIn />;
}

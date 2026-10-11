'use client';

import { ThemeToggle } from '@/components/ui';
import { LocaleSwitcher } from '@/features/localization';

/** The language and the theme of a header. */
export function HeaderControls() {
  return (
    <>
      <LocaleSwitcher />
      <ThemeToggle />
    </>
  );
}

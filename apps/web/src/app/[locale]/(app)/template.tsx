import type { ReactNode } from 'react';
import { PageTransition } from '@/components/motion';

/** Remounted on every page of the group: page transition of level 1, the shell stays still. */
export default function GroupTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}

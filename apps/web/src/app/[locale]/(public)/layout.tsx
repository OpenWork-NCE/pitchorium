import type { ReactNode } from 'react';
import { initialCounters } from '@/components/layout/member/initial-counters';
import { LazyMemberShell } from '@/components/layout/member/lazy-member-shell';
import { PublicShell } from '@/components/layout/shells/public-shell';
import { getCurrentMember } from '@/lib/auth/session';

/**
 * Pages of a resource, one address for visitors and members (ADR 0101): the shell follows the
 * session, the shell of the member space for a member, the public one, indexable, for a visitor.
 * The client frame of the member shell is loaded on demand: a visitor never downloads it.
 */
export default async function ResourceLayout({ children }: { children: ReactNode }) {
  const member = await getCurrentMember();
  if (!member) return <PublicShell>{children}</PublicShell>;
  return (
    <LazyMemberShell member={member} counters={await initialCounters()}>
      {children}
    </LazyMemberShell>
  );
}

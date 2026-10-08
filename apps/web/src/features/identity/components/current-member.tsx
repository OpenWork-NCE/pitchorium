'use client';

import type { CurrentUserDtoOutput } from '@pitchorium/api-client';
import { createContext, type ReactNode, use } from 'react';

const CurrentMemberContext = createContext<CurrentUserDtoOutput | null>(null);

/**
 * The member of the session, read once by the server (`GET /v1/me`, lib/auth/session.ts) and
 * handed to the client components of the member space: header, account banners, menus.
 */
export function CurrentMemberProvider({
  member,
  children,
}: {
  member: CurrentUserDtoOutput;
  children: ReactNode;
}) {
  return <CurrentMemberContext value={member}>{children}</CurrentMemberContext>;
}

export function useCurrentMember(): CurrentUserDtoOutput {
  const member = use(CurrentMemberContext);
  if (!member) throw new Error('useCurrentMember outside of the member space');
  return member;
}

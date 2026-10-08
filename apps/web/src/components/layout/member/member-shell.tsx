import type { CountersDtoOutput, CurrentUserDtoOutput } from '@pitchorium/api-client';
import type { ReactNode } from 'react';
import { AnnouncerProvider, ShortcutsProvider } from '@/components/ui';
import { AccountBanners, CurrentMemberProvider } from '@/features/identity';
import { RealtimeProvider } from '@/lib/realtime/realtime-provider';
import { DataProvider } from '../data-provider';
import { InteractiveRuntime } from '../interactive-runtime';
import { RouteFocus } from '../route-focus';
import { UrlStateProvider } from '../url-state';
import { MemberHeader } from './member-header';
import { OfflineBanner } from './offline-banner';
import { PersistedMutations } from './persisted-mutations';

interface MemberShellProps {
  member: CurrentUserDtoOutput;
  /** Counters read by the server for the first render, null if the api could not say. */
  counters: CountersDtoOutput | null;
  children: ReactNode;
}

/**
 * Shell of the member space (ADR 0099): its runtime (data, realtime, URL state, announcements,
 * shortcuts), the header, the banners of the account and of the network, then the page, which
 * renders its own `main` (page-layouts.tsx).
 */
export function MemberShell({ member, counters, children }: MemberShellProps) {
  return (
    <InteractiveRuntime scope="member">
      <DataProvider>
        <RealtimeProvider>
          <UrlStateProvider>
            <CurrentMemberProvider member={member}>
              <AnnouncerProvider>
                <ShortcutsProvider>
                  <div className="flex min-h-dvh flex-col [--header-height:4.5rem]">
                    <MemberHeader initialCounters={counters} />
                    <AccountBanners />
                    <OfflineBanner />
                    <div className="flex-1">{children}</div>
                  </div>
                  <RouteFocus />
                  <PersistedMutations memberId={member.user.id} />
                </ShortcutsProvider>
              </AnnouncerProvider>
            </CurrentMemberProvider>
          </UrlStateProvider>
        </RealtimeProvider>
      </DataProvider>
    </InteractiveRuntime>
  );
}

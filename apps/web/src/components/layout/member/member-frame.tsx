'use client';

import type { CountersDtoOutput, CurrentUserDtoOutput } from '@pitchorium/api-client';
import type { ReactNode } from 'react';
import { AnnouncerProvider, ShortcutsProvider } from '@/components/ui';
import { PrerequisiteGateProvider } from '@/features/access';
import { AccountBanners, CurrentMemberProvider } from '@/features/identity';
import { RealtimeProvider } from '@/lib/realtime/realtime-provider';
import { DataProvider } from '../data-provider';
import { RouteFocus } from '../route-focus';
import { UrlStateProvider } from '../url-state';
import { MemberHeader } from './member-header';
import { OfflineBanner } from './offline-banner';
import { PersistedMutations } from './persisted-mutations';
import { MEMBER_PREREQUISITE_FORMS } from './prerequisite-forms';

export interface MemberFrameProps {
  member: CurrentUserDtoOutput;
  /** Counters read by the server for the first render, null if the api could not say. */
  counters: CountersDtoOutput | null;
  children: ReactNode;
}

/**
 * Client part of the member shell (ADR 0099): data, realtime, URL state, current member,
 * announcements, prerequisites, shortcuts, then the header, the banners and the page.
 */
export function MemberFrame({ member, counters, children }: MemberFrameProps) {
  return (
    <DataProvider>
      <RealtimeProvider>
        <UrlStateProvider>
          <CurrentMemberProvider member={member}>
            <AnnouncerProvider>
              <PrerequisiteGateProvider forms={MEMBER_PREREQUISITE_FORMS}>
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
              </PrerequisiteGateProvider>
            </AnnouncerProvider>
          </CurrentMemberProvider>
        </UrlStateProvider>
      </RealtimeProvider>
    </DataProvider>
  );
}

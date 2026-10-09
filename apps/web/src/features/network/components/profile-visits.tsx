'use client';

import { profileViewsControllerVisits } from '@pitchorium/api-client';
import type { ProfileVisit } from '@pitchorium/contracts';
import { EyeOff } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { CursorList, useCursorList } from './cursor-list';
import { MemberRow } from './member-lists';

/**
 * The visits of the profile, newest first (§10.2): the card of each visitor, or the anonymized
 * mention the api gives for a private visit (« un membre du secteur X »), never more.
 */
export function ProfileVisits() {
  const t = useTranslations('web.network.visits');
  const sectors = useTranslations('reference.sectors');
  const format = useFormatter();
  // A code without a label (a sector added after this release) is said as such.
  const sectorLabel = (code: string) =>
    sectors.has(code as never) ? sectors(code as never) : code;
  const list = useCursorList<ProfileVisit>(['profile-views'], (params) =>
    profileViewsControllerVisits(params),
  );
  const day = (visit: ProfileVisit) => (
    <p className="text-xs text-muted">
      {t('day', {
        date: format.dateTime(new Date(visit.day), { dateStyle: 'medium', timeZone: 'UTC' }),
      })}
    </p>
  );
  return (
    <CursorList
      list={list}
      label={t('list')}
      empty={{ title: t('empty') }}
      renderItem={(visit) =>
        visit.visitor ? (
          <MemberRow
            key={`${visit.day}:${visit.visitor.handle}`}
            member={visit.visitor}
            signedIn
            meta={day(visit)}
          />
        ) : (
          <li
            key={`${visit.day}:${list.items.indexOf(visit)}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-2 py-3"
          >
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-muted">
              <EyeOff aria-hidden className="size-5" />
            </span>
            <div className="grid min-w-0 flex-1 basis-48 gap-0.5">
              <span className="font-medium">
                {visit.anonymous?.sectorCode
                  ? t('anonymous', { sector: sectorLabel(visit.anonymous.sectorCode) })
                  : t('anonymousUnknown')}
              </span>
              <p className="text-sm text-muted">{t('privateNote')}</p>
              {day(visit)}
            </div>
          </li>
        )
      }
    />
  );
}

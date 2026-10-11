'use client';

import type { MissionCard as MissionCardData, MissionEngagement } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Pagination } from '@/components/ui';
import type { MissionFilters } from '../lib/missions-query';
import { EngagementRow } from './engagement-row';
import { MissionCard } from './mission-card';

/** The next pages of missions or engagements, after the first one rendered by the server. */
export function MissionsMore({
  filters,
  cursor: first,
  signedIn,
  shown,
  viewerHandle,
}: {
  filters: MissionFilters;
  cursor: string | null;
  signedIn: boolean;
  shown: number;
  viewerHandle: string | null;
}) {
  const t = useTranslations('web.missions.list');
  const [missions, setMissions] = useState<MissionCardData[]>([]);
  const [engagements, setEngagements] = useState<MissionEngagement[]>([]);
  const [cursor, setCursor] = useState(first);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function more() {
    if (!cursor) return;
    setLoading(true);
    setFailed(false);
    try {
      const fetch = await import('./missions-fetch');
      if (filters.tab === 'engagements') {
        const page = await fetch.fetchEngagementsPage(filters, cursor);
        setEngagements((current) => [...current, ...page.items]);
        setCursor(page.nextCursor);
      } else {
        const page = await fetch.fetchMissionsPage(filters, cursor, signedIn);
        setMissions((current) => [...current, ...page.items]);
        setCursor(page.nextCursor);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {missions.length > 0 ? (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {missions.map((mission) => (
            <li key={mission.id} className="grid">
              <MissionCard mission={mission} />
            </li>
          ))}
        </ul>
      ) : null}
      {engagements.length > 0 ? (
        <ul className="grid gap-3">
          {engagements.map((engagement) => (
            <li key={engagement.id}>
              <EngagementRow engagement={engagement} viewerHandle={viewerHandle} />
            </li>
          ))}
        </ul>
      ) : null}
      <Pagination
        hasMore={cursor !== null}
        loading={loading}
        onLoadMore={() => void more()}
        shown={shown + missions.length + engagements.length}
      />
      {failed ? (
        <p role="alert" className="text-center text-sm text-danger">
          {t('moreError')}
        </p>
      ) : null}
    </>
  );
}

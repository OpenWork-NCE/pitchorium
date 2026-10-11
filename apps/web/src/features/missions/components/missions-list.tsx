import type { MissionCard as MissionCardData, MissionEngagement } from '@pitchorium/contracts';
import { BriefcaseBusiness, HandHeart } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button, Callout, EmptyState } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import { isFiltered, type MissionFilters } from '../lib/missions-query';
import { EngagementRow } from './engagement-row';
import { MissionCard } from './mission-card';
import { MissionsBrowser } from './missions-browser';
import { MissionsMore } from './missions-more';

interface Option {
  value: string;
  label: string;
}

type Page<T> = { items: T[]; nextCursor: string | null } | null;

/**
 * The missions of skills sponsorship (§6.3, ADR 0071): what they are said first (volunteer, no
 * job offer), then the offers and requests in a grid, or the member's own missions and
 * engagements; filters in the address, first page by the server.
 */
export async function MissionsList({
  filters,
  missions,
  engagements,
  signedIn,
  viewerHandle,
  countries,
  sectors,
  languages,
}: {
  filters: MissionFilters;
  missions: Page<MissionCardData>;
  engagements: Page<MissionEngagement>;
  signedIn: boolean;
  viewerHandle: string | null;
  countries: readonly Option[];
  sectors: readonly Option[];
  languages: readonly Option[];
}) {
  const t = await getTranslations('web.missions.list');
  const page = filters.tab === 'engagements' ? engagements : missions;
  const create = signedIn ? (
    <div className="flex flex-wrap justify-center gap-2">
      <Button asChild>
        <Link href={`${routes.createMission}?direction=offer`}>{t('offer')}</Link>
      </Button>
      <Button asChild variant="secondary">
        <Link href={`${routes.createMission}?direction=request`}>{t('request')}</Link>
      </Button>
    </div>
  ) : undefined;
  const empty = filters.tab === 'all' ? (isFiltered(filters) ? 'filtered' : 'all') : filters.tab;
  return (
    <div className="grid gap-6">
      <Callout icon={<HandHeart />} title={t('volunteerTitle')}>
        {t('volunteer')}
      </Callout>
      <MissionsBrowser
        signedIn={signedIn}
        countries={countries}
        sectors={sectors}
        languages={languages}
      >
        {page === null ? (
          <EmptyState size="page" title={t('error')} description={t('errorBody')} />
        ) : page.items.length === 0 ? (
          <EmptyState
            icon={<BriefcaseBusiness />}
            title={t(`empty.${empty}.title`)}
            description={t(`empty.${empty}.body`)}
            action={empty === 'filtered' ? undefined : create}
          />
        ) : (
          <div className="grid gap-6">
            {filters.tab === 'engagements' ? (
              <ul className="grid gap-3">
                {(page.items as MissionEngagement[]).map((engagement) => (
                  <li key={engagement.id}>
                    <EngagementRow engagement={engagement} viewerHandle={viewerHandle} />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {(page.items as MissionCardData[]).map((mission) => (
                  <li key={mission.id} className="grid">
                    <MissionCard mission={mission} />
                  </li>
                ))}
              </ul>
            )}
            <MissionsMore
              filters={filters}
              cursor={page.nextCursor}
              signedIn={signedIn}
              shown={page.items.length}
              viewerHandle={viewerHandle}
            />
          </div>
        )}
      </MissionsBrowser>
    </div>
  );
}

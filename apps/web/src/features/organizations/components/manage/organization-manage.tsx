'use client';

import type { Organization } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { lazy, type ReactNode, Suspense, useState } from 'react';
import { Alert, Card, Loading, Skeleton, Tabs, TabsPanel } from '@/components/ui';
import { canManage } from '../../lib/roles';

/** Each tab loads when it opens: its forms, their controls and their validation (ADR 0094). */
const DetailsPanel = lazy(() =>
  import('./details-panel').then((module) => ({ default: module.DetailsPanel })),
);
const MembersPanel = lazy(() =>
  import('./members-panel').then((module) => ({ default: module.MembersPanel })),
);
const VerificationPanel = lazy(() =>
  import('./verification-panel').then((module) => ({ default: module.VerificationPanel })),
);

/** A tab while it loads: cards shaped like its content. */
function Deferred({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <Loading className="grid gap-6">
          {[0, 1].map((index) => (
            <Card key={index} className="grid gap-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-11" />
              <Skeleton className="h-11" />
            </Card>
          ))}
        </Loading>
      }
    >
      {children}
    </Suspense>
  );
}

const TABS = ['details', 'members', 'verification'] as const;

/**
 * Management of an organisation (§10.7): its page (fields, logo and cover, address, deletion),
 * its members and invitations, its verification. The organisation read by the server is the
 * starting state; each answer of the api replaces it. A member who is neither owner nor admin
 * finds only the members, to leave.
 */
export function OrganizationManage({
  initial,
  created,
}: {
  initial: Organization;
  /** Just created: a word of welcome above the tabs. */
  created: boolean;
}) {
  const t = useTranslations('web.organizations.manage');
  const [organization, setOrganization] = useState(initial);
  const manager = canManage(organization.viewerRole);
  const tabs = manager ? TABS : (['members'] as const);
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(TABS).withDefault(manager ? 'details' : 'members'),
  );
  return (
    <div className="grid gap-6">
      {created ? (
        <Alert tone="success" title={t('createdTitle')}>
          {t('created')}
        </Alert>
      ) : null}
      <Tabs
        value={tabs.includes(tab as never) ? tab : tabs[0]}
        onValueChange={(next) => void setTab(next)}
        label={t('sections')}
        tabs={tabs.map((value) => ({ value, label: t(`tabs.${value}`) }))}
      >
        {manager ? (
          <TabsPanel value="details">
            <Deferred>
              <DetailsPanel organization={organization} onChange={setOrganization} />
            </Deferred>
          </TabsPanel>
        ) : null}
        <TabsPanel value="members">
          <Deferred>
            <MembersPanel organization={organization} onChange={setOrganization} />
          </Deferred>
        </TabsPanel>
        {manager ? (
          <TabsPanel value="verification">
            <Deferred>
              <VerificationPanel organization={organization} />
            </Deferred>
          </TabsPanel>
        ) : null}
      </Tabs>
    </div>
  );
}

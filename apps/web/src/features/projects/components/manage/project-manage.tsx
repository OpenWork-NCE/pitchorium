'use client';

import type { FollowState, Project } from '@pitchorium/contracts';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import type { ReactNode } from 'react';
import { UrlStateProvider } from '@/components/layout/url-state';
import { Tabs, TabsPanel } from '@/components/ui';
import { ProjectEditorProvider } from '../editor/editor-context';
import { OverviewPanel } from './overview-panel';

/* The tabs other than the overview, loaded on demand (ADR 0094). */
const UpdatesPanel = dynamic(() => import('./updates-panel').then((m) => m.UpdatesPanel));
const InterestsPanel = dynamic(() => import('./interests-panel').then((m) => m.InterestsPanel));
const TeamPanel = dynamic(() => import('../editor/team-panel').then((m) => m.TeamPanel));
const RewardsPanel = dynamic(() => import('../editor/rewards-panel').then((m) => m.RewardsPanel));

const TABS = [
  'overview',
  'contributions',
  'offline',
  'supporters',
  'updates',
  'interests',
  'team',
  'rewards',
] as const;
const PAYMENT_TABS = new Set<string>(['contributions', 'offline', 'supporters']);

/** The parts of the payments feature, composed by the route (ADR 0136). */
export interface ManagePayments {
  /** State of the payout and of the identity check of the holder, over the tabs. */
  banner: ReactNode;
  contributions: ReactNode;
  offline: ReactNode;
  supporters: ReactNode;
}

/**
 * The management of a project by its team (§11.3): its overview, its contributions with their
 * export, the off-platform contributions to confirm, its public supporters, its updates, the
 * expressions of interest received, its team and its rewards with their stocks, a tab in the
 * address. The parts of the payments come from the route (`payments`), absent for a draft.
 */
function Manage({
  project,
  follow,
  payments = null,
}: {
  project: Project;
  follow: FollowState | null;
  payments?: ManagePayments | null;
}) {
  const t = useTranslations('web.projects.manage');
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(TABS).withDefault('overview'));
  const tabs = payments ? TABS : TABS.filter((value) => !PAYMENT_TABS.has(value));
  return (
    <ProjectEditorProvider initial={project}>
      {payments?.banner}
      <Tabs
        value={tab}
        onValueChange={(value) => void setTab(value)}
        label={t('tabsLabel')}
        tabs={tabs.map((value) => ({ value, label: t(`tabs.${value}`) }))}
      >
        <TabsPanel value="overview" className="pt-6">
          <OverviewPanel follow={follow} />
        </TabsPanel>
        {payments ? (
          <>
            <TabsPanel value="contributions" className="pt-6">
              {payments.contributions}
            </TabsPanel>
            <TabsPanel value="offline" className="pt-6">
              {payments.offline}
            </TabsPanel>
            <TabsPanel value="supporters" className="pt-6">
              {payments.supporters}
            </TabsPanel>
          </>
        ) : null}
        <TabsPanel value="updates" className="pt-6">
          <UpdatesPanel />
        </TabsPanel>
        <TabsPanel value="interests" className="pt-6">
          <InterestsPanel />
        </TabsPanel>
        <TabsPanel value="team" className="pt-6">
          <TeamPanel />
        </TabsPanel>
        <TabsPanel value="rewards" className="pt-6">
          <RewardsPanel />
        </TabsPanel>
      </Tabs>
    </ProjectEditorProvider>
  );
}

/** The management, with the URL state of its tabs (nuqs, mounted by its users, ADR 0094). */
export function ProjectManage(props: Parameters<typeof Manage>[0]) {
  return (
    <UrlStateProvider>
      <Manage {...props} />
    </UrlStateProvider>
  );
}

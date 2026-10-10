import type { ImpactDashboard, ProjectStatus } from '@pitchorium/contracts';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Badge, Callout, Card, Heading, Link } from '@/components/ui';
import { routes } from '@/config/routes';
import { EngagementChart } from './engagement-chart';
import { EngagementStats } from './engagement-stats';
import { HistoryDownload } from './history-download';

/** A project the member or the organisation supported, with its status read from the api. */
export interface SupportedProject {
  id: string;
  slug: string;
  title: string;
  status: ProjectStatus | null;
}

/**
 * The engagement dashboard (section 9.4, ADR 0141): an engagement dashboard, not a bank account,
 * no balance. Euros really given this month and since the start, projects supported with their
 * status, hours declared and confirmed (a member only), the money given over twelve months and
 * the history to download. The contributions of the member come from the payments (`children`).
 */
export async function EngagementDashboard({
  dashboard,
  projects,
  organizationId,
  children,
}: {
  dashboard: ImpactDashboard;
  projects: readonly SupportedProject[];
  /** The dashboard of an organisation; null for the member's own. */
  organizationId: string | null;
  children?: ReactNode;
}) {
  const t = await getTranslations('web.engagement.dashboard');
  const statuses = await getTranslations('reference.projectStatuses');
  const member = organizationId === null;
  return (
    <div className="grid gap-8">
      <Callout>{t('notABank')}</Callout>
      <EngagementStats dashboard={dashboard} hours={member} />
      {member ? (
        <p className="text-sm">
          <Link href={routes.timeLog} variant="standalone">
            {t('timeLog')}
          </Link>
        </p>
      ) : null}
      <Card className="grid gap-5">
        <EngagementChart monthly={dashboard.monthly} />
        <HistoryDownload organizationId={organizationId} />
      </Card>
      <section aria-labelledby="supported-projects" className="grid gap-4">
        <Heading level={2} size="section" id="supported-projects">
          {t('projects')}
        </Heading>
        {projects.length === 0 ? (
          <p className="text-sm text-muted">{t('noProject')}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {projects.map((project) => (
              <li key={project.slug}>
                <Card padding="sm" className="flex items-center justify-between gap-3">
                  <Link
                    href={routes.project(project.slug)}
                    className="min-w-0 truncate font-medium"
                  >
                    {project.title}
                  </Link>
                  {project.status ? <Badge>{statuses(project.status)}</Badge> : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      {children}
    </div>
  );
}

'use client';

import { useInterestsControllerList } from '@pitchorium/api-client';
import type { FollowState } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { Button, Card, FundingProgress, Heading, Stat } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { pluralOf } from '@/lib/i18n/plural-of';
import { fundingState } from '../../lib/funding-state';
import { useProjectEditor } from '../editor/editor-context';

/**
 * Overview of a project for its team (§11.3): collected and goal, contributions, followers,
 * expressions of interest received, the state of the campaign, and the ways to its page and to
 * its edition.
 */
export function OverviewPanel({ follow }: { follow: FollowState | null }) {
  const t = useTranslations('web.projects.manage.overview');
  const funding = useTranslations('web.projects.funding');
  const statuses = useTranslations('reference.projectStatuses');
  const locale = useLocale();
  const { project } = useProjectEditor();
  const interests = useInterestsControllerList(
    project.id,
    { limit: 100 },
    { query: { staleTime: 60_000 } },
  );
  const state = fundingState(project.status, project.funding, {
    frozen: project.fundingFrozen,
    durationDays: project.management?.durationDays ?? null,
  });
  const count = (value: number) => new Intl.NumberFormat(locale).format(value);
  const interestCount = interests.data?.items.length ?? null;
  return (
    <div className="grid gap-6">
      {/* One list per card: a card between <dl> and its groups would break the list (axe). */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card padding="sm">
          <dl>
            <Stat
              label={t('contributions')}
              value={project.funding.contributionCount}
              format={count}
            />
          </dl>
        </Card>
        <Card padding="sm">
          <dl>
            <Stat label={t('followers')} value={follow?.followers ?? 0} format={count} />
          </dl>
        </Card>
        <Card padding="sm">
          <dl>
            <Stat
              label={t('interests')}
              value={interestCount ?? 0}
              format={(value) => `${count(value)}${interests.data?.nextCursor ? '+' : ''}`}
            />
          </dl>
        </Card>
      </div>
      <Card className="grid gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Heading level={2} size="card">
            {t('campaign')}
          </Heading>
          <span className="text-sm text-muted">{statuses(project.status)}</span>
        </div>
        {project.funding.goal ? (
          <FundingProgress
            label={funding('progress', { title: project.title })}
            raised={project.funding.collected}
            goal={project.funding.goal}
            daysLeft={state.time.kind === 'daysLeft' ? state.time.days : null}
            {...(state.time.kind === 'lastDay'
              ? { remainingLabel: funding('lastDay') }
              : state.time.kind === 'ended'
                ? {
                    remainingLabel: funding(
                      state.outcome === 'closed_funded' ? 'endedFunded' : 'endedClosed',
                    ),
                  }
                : state.time.kind === 'duration'
                  ? {
                      remainingLabel: state.time.days
                        ? funding(`duration.${pluralOf(locale, state.time.days)}`, {
                            count: state.time.days,
                          })
                        : funding('durationUnset'),
                    }
                  : {})}
            milestones={project.tiers.map((tier) => ({
              amountMinor: tier.threshold.amountMinor,
              label: tier.description,
            }))}
          />
        ) : (
          <p className="text-sm text-muted">{funding('goalUnset')}</p>
        )}
        <p className="text-sm text-muted">{t('contributionsLater')}</p>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link href={routes.project(project.slug)}>{t('viewPage')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={routes.projectEdit(project.slug, 'essentials')}>{t('edit')}</Link>
        </Button>
      </div>
    </div>
  );
}

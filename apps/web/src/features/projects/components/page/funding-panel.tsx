import type { Locale, Project } from '@pitchorium/contracts';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Alert, Badge, Callout, FundingProgress, Heading } from '@/components/ui';
import { formatMoney } from '@/lib/format/money';
import { pluralOf } from '@/lib/i18n/plural-of';
import { fundingState } from '../../lib/funding-state';
import { type FixedParity, indicativeEquivalent } from '../../lib/indicative-equivalent';

/**
 * The funding block of a project (§11.2, §9.1, §15 decision 5): collected and goal, the progress
 * with its tiers, the days left or the final state, the instruments accepted, « nous ouvrons le
 * capital » as an intention only, and, for a member of the CFA zone, the indicative equivalent
 * in francs (ADR 0130). Its actions (follow, interest, share) come in `actions`.
 */
export async function FundingPanel({
  project,
  locale,
  parity,
  actions,
}: {
  project: Project;
  locale: Locale;
  /** The franc of the reader at its fixed parity, null for a visitor or a floating currency. */
  parity: FixedParity | null;
  actions?: ReactNode;
}) {
  const t = await getTranslations('web.projects.funding');
  const reference = await getTranslations('reference');
  const { funding } = project;
  const state = fundingState(project.status, funding, {
    frozen: project.fundingFrozen,
    durationDays: project.management?.durationDays ?? null,
  });
  const plural = (count: number) => pluralOf(locale, count);
  const remaining =
    state.time.kind === 'duration'
      ? state.time.days
        ? t(`duration.${plural(state.time.days)}`, { count: state.time.days })
        : t('durationUnset')
      : state.time.kind === 'lastDay'
        ? t('lastDay')
        : state.time.kind === 'ended'
          ? t(state.outcome === 'closed_funded' ? 'endedFunded' : 'endedClosed')
          : undefined;
  const equivalent = (amount: Project['funding']['collected'] | null) =>
    amount && parity ? indicativeEquivalent(amount, parity) : null;
  const collectedEquivalent = equivalent(funding.collected);
  const goalEquivalent = equivalent(funding.goal);
  return (
    <section aria-labelledby="funding-title" className="grid gap-5">
      <Heading level={2} size="card" id="funding-title">
        {t('title')}
      </Heading>
      {funding.goal ? (
        <FundingProgress
          label={t('progress', { title: project.title })}
          raised={funding.collected}
          goal={funding.goal}
          daysLeft={state.time.kind === 'daysLeft' ? state.time.days : null}
          {...(remaining ? { remainingLabel: remaining } : {})}
          milestones={project.tiers.map((tier) => ({
            amountMinor: tier.threshold.amountMinor,
            label: tier.description,
          }))}
        />
      ) : (
        <p className="text-sm text-muted">{t('goalUnset')}</p>
      )}
      {collectedEquivalent && goalEquivalent ? (
        <p className="text-sm text-muted tabular-nums" data-testid="indicative-equivalent">
          {t('equivalent', {
            collected: formatMoney(collectedEquivalent, locale),
            goal: formatMoney(goalEquivalent, locale),
          })}
        </p>
      ) : null}
      {project.status !== 'draft' ? (
        <p className="text-sm">
          {t(`contributions.${plural(funding.contributionCount)}`, {
            count: new Intl.NumberFormat(locale).format(funding.contributionCount),
          })}
          {state.outcome === 'funded' ? (
            <>
              <span aria-hidden> · </span>
              <span className="font-medium text-success">{t('goalReached')}</span>
            </>
          ) : null}
        </p>
      ) : null}
      {state.frozen ? <Alert tone="warning">{t('frozen')}</Alert> : null}
      {funding.instruments.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">{t('instruments')}</p>
          <ul className="flex flex-wrap gap-2">
            {funding.instruments.map((instrument) => (
              <li key={instrument}>
                <Badge>{reference(`fundingInstruments.${instrument}` as never)}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {funding.opensCapital ? (
        <Callout title={t('opensCapital.title')}>{t('opensCapital.body')}</Callout>
      ) : null}
      {actions}
    </section>
  );
}

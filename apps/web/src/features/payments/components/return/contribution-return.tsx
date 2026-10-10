'use client';

import { ApiProblemError } from '@pitchorium/api-client';
import {
  contributionsControllerOne,
  contributionsControllerReturned,
  projectsControllerForMember,
} from '@pitchorium/api-client';
import type { Contribution, Project } from '@pitchorium/contracts';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AnimatedNumber } from '@/components/motion';
import { Alert, Button, DrawnCheck, Heading, Notice, Spinner } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { formatMoney } from '@/lib/format/money';
import { createPoller, RETURN_POLL_INTERVAL_MS, RETURN_POLL_MAX_MS } from '../../lib/poll';
import { returnOutcome } from '../../lib/status';
import { usePaymentProblem } from '../shared/use-payment-problem';

/** A refusal reading again cannot change: the contribution is not the reader's, or gone. */
const fatal = (error: unknown) =>
  error instanceof ApiProblemError && error.problem.status >= 400 && error.problem.status < 500;

/**
 * An amount that counts up once, in whole minor units: no floating point amount is ever shown
 * (H17, ADR 0136); its final value is the amount of the api.
 */
function CountedAmount({ amount }: { amount: Contribution['amount'] }) {
  const locale = useLocale();
  const minor = Number(amount.amountMinor);
  return (
    <AnimatedNumber
      value={minor}
      step={1}
      format={(value) =>
        formatMoney(
          { amountMinor: String(Math.round(value)), currency: amount.currency },
          locale,
          'financial',
        )
      }
    />
  );
}

/**
 * The tiers the collected amount reached while this payment was being made: their first
 * unlocking (date of the api) comes after the contribution was created.
 */
function useUnlockedTiers(contribution: Contribution, enabled: boolean) {
  const project = useQuery({
    queryKey: ['payments', 'return', 'project', contribution.project.slug],
    queryFn: ({ signal }) =>
      projectsControllerForMember(contribution.project.slug, { signal }) as Promise<Project>,
    enabled,
    staleTime: 0,
  });
  const created = Date.parse(contribution.createdAt);
  return (project.data?.tiers ?? []).filter(
    (tier) => tier.unlockedAt !== null && Date.parse(tier.unlockedAt) >= created,
  );
}

/**
 * The page of return from the provider (§9.3, ADR 0137): its address proves nothing, only the
 * api says when the payment is final. It asks the api to read the state at the provider, then
 * reads the contribution at a steady interval while the tab is visible, two minutes at most;
 * pending, paid, or not paid with a new attempt that keeps the choices.
 */
export function ContributionReturn({
  initial,
  follow,
  share,
}: {
  initial: Contribution;
  /** Follow the project, rendered by the page (network feature). */
  follow?: ReactNode;
  /** Share the project, WhatsApp first, rendered by the page (projects feature). */
  share?: ReactNode;
}) {
  const t = useTranslations('web.payments.return');
  const locale = useLocale();
  const problem = usePaymentProblem();
  const [contribution, setContribution] = useState(initial);
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const poller = useRef<ReturnType<typeof createPoller<Contribution>> | null>(null);
  /** The next reading asks the api to read the provider (at the return, and on « check again »). */
  const askProvider = useRef(true);
  const outcome = returnOutcome(contribution.status);

  useEffect(() => {
    const instance = createPoller<Contribution>({
      // The first reading asks the api to read the provider without waiting for its webhook.
      read: async () => {
        if (askProvider.current) {
          askProvider.current = false;
          return contributionsControllerReturned(initial.id);
        }
        return contributionsControllerOne(initial.id);
      },
      done: (value) => returnOutcome(value.status) !== 'pending',
      fatal,
      onValue: (value) => {
        setError(null);
        setContribution(value);
      },
      onError: (failure) => setError(problem(failure)),
      onTimeout: () => setTimedOut(true),
      intervalMs: RETURN_POLL_INTERVAL_MS,
      maxDurationMs: RETURN_POLL_MAX_MS,
    });
    poller.current = instance;
    if (returnOutcome(initial.status) === 'pending') instance.start();
    return () => instance.stop();
  }, [initial.id, initial.status, problem]);

  const tiers = useUnlockedTiers(contribution, outcome === 'paid');
  const project = contribution.project;
  const retry = `${routes.project(project.slug)}?contribute=review&from=${contribution.id}`;

  if (outcome === 'paid') {
    return (
      <section aria-labelledby="return-title" className="grid gap-6" data-outcome="paid">
        <div className="grid justify-items-start gap-4">
          <DrawnCheck />
          <Heading level={1} size="page" id="return-title">
            {t('paid.title')}
          </Heading>
          <p
            className="font-display text-3xl font-extrabold tabular-nums"
            data-testid="paid-amount"
          >
            <CountedAmount amount={contribution.amount} />
          </p>
          <p className="text-muted">{t('paid.body', { title: project.title })}</p>
        </div>
        {tiers.length > 0 ? (
          <ul className="grid gap-2" aria-label={t('paid.tiers')}>
            {tiers.map((tier) => (
              <li
                key={tier.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <DrawnCheck className="size-6 shrink-0" />
                <span className="grid gap-0.5">
                  <span className="font-medium">
                    {t('paid.tierUnlocked', {
                      position: tier.position,
                      amount: formatMoney(tier.threshold, locale),
                    })}
                  </span>
                  <span className="text-sm text-muted">{tier.description}</span>
                </span>
              </li>
            ))}
            <li className="text-xs text-muted">{t('paid.noGuarantee')}</li>
          </ul>
        ) : null}
        <Notice kind="notTaxReceipt" />
        <p className="text-sm text-muted">{t('paid.email')}</p>
        <div className="grid gap-4 rounded-2xl border border-border bg-surface p-5">
          <p className="font-medium">{t('paid.next')}</p>
          {follow}
          {share}
        </div>
        <Button asChild variant="ghost" className="justify-self-start">
          <Link href={routes.project(project.slug)}>{t('backToProject')}</Link>
        </Button>
      </section>
    );
  }

  if (outcome === 'unpaid') {
    return (
      <section aria-labelledby="return-title" className="grid gap-5" data-outcome="unpaid">
        <Heading level={1} size="page" id="return-title">
          {t(`unpaid.${contribution.status as 'failed' | 'expired' | 'canceled'}.title`)}
        </Heading>
        <p>{t(`unpaid.${contribution.status as 'failed' | 'expired' | 'canceled'}.body`)}</p>
        <p className="text-sm text-muted">{t('unpaid.nothingCharged')}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={retry}>{t('unpaid.retry')}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={routes.project(project.slug)}>{t('backToProject')}</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="return-title"
      className="grid gap-5"
      data-outcome="pending"
      aria-busy={!timedOut || undefined}
    >
      <Heading level={1} size="page" id="return-title">
        {t('pending.title')}
      </Heading>
      <p className="flex items-center gap-3" role="status">
        {timedOut ? null : <Spinner size="sm" label={t('pending.checking')} />}
        <span>{t(timedOut ? 'pending.slow' : 'pending.body')}</span>
      </p>
      <p className="text-sm text-muted">
        {t('pending.amount', { amount: formatMoney(contribution.amount, locale, 'financial') })}
      </p>
      <p className="text-sm text-muted">{t('pending.later')}</p>
      {error ? (
        <Alert tone="warning" live="status">
          {error}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {timedOut ? (
          <Button
            type="button"
            onClick={() => {
              setTimedOut(false);
              askProvider.current = true;
              poller.current?.start();
            }}
          >
            {t('pending.checkAgain')}
          </Button>
        ) : null}
        <Button asChild variant="ghost">
          <Link href={routes.project(project.slug)}>{t('backToProject')}</Link>
        </Button>
      </div>
    </section>
  );
}

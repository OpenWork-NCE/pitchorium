'use client';

import {
  contributionsControllerCancel,
  contributionsControllerMine,
  getContributionsControllerMineQueryKey,
} from '@pitchorium/api-client';
import type { Contribution, FundingInstrument, ProjectReward } from '@pitchorium/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HandHeart } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { lazy, Suspense, useState } from 'react';
import { UrlStateProvider } from '@/components/layout/url-state';
import { Alert, Button, ErrorState, Skeleton } from '@/components/ui';
import { publicEnv } from '@/lib/public-env';
import { formatMoney } from '@/lib/format/money';
import { safePaymentUrl } from '../../lib/payment-url';
import { resumableContribution } from '../../lib/status';
import { usePaymentProblem } from '../shared/use-payment-problem';
import { AvailabilityNotice } from './availability-notice';
import { usePaymentOptions } from './use-payment-options';

const ContributeDialog = lazy(() => import('./contribute-dialog'));
const DeclareOfflineDialog = lazy(() => import('../offline/declare-offline-dialog'));

/** What the entry knows of the project: read by the server with the page. */
export interface ContributeProject {
  id: string;
  slug: string;
  title: string;
  instruments: FundingInstrument[];
  rewards: ProjectReward[];
}

/** Pending contributions of the member, to propose the one of this project again. */
function usePendingContributions() {
  const params = { status: 'pending_payment' as const, limit: 20 };
  return useQuery({
    queryKey: getContributionsControllerMineQueryKey(params),
    queryFn: ({ signal }) => contributionsControllerMine(params, { signal }),
    staleTime: 30_000,
  });
}

/**
 * « Contribuer » on the page of a project (§9.3, ADR 0136): the availability read from the api
 * (never deduced), then the journey in a dialog, one step per address (`?contribute=<step>`). A
 * pending payment of the member on this project is proposed again rather than a new one. When
 * contributions are not open online, the honest state of the project and the ways to support it
 * without paying online (ADR 0138).
 */
function Entry({ project, layout }: { project: ContributeProject; layout: 'stack' | 'bar' }) {
  const t = useTranslations('web.payments.entry');
  const locale = useLocale();
  const problem = usePaymentProblem();
  const queryClient = useQueryClient();
  const options = usePaymentOptions(project.id);
  const pending = usePendingContributions();
  const [step, setStep] = useQueryState(
    'contribute',
    parseAsString.withOptions({ history: 'push' }),
  );
  const [from, setFrom] = useQueryState('from', parseAsString);
  // The interest dialog of the page opens from the address (projects feature).
  const [, setInterest] = useQueryState('interest', parseAsString);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [offlineMounted, setOfflineMounted] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // The time of the reading, not of each render: a pending payment expires with its session.
  const [now] = useState(() => Date.now());

  if (options.isPending) {
    return (
      <Skeleton
        className={layout === 'bar' ? 'h-11 w-40 rounded-full' : 'h-11 w-full rounded-full'}
      />
    );
  }
  if (options.isError) {
    if (layout === 'bar') return null;
    return (
      <ErrorState
        size="inline"
        title={t('unreadable')}
        description={problem(options.error)}
        onRetry={() => void options.refetch()}
      />
    );
  }
  const data = options.data;
  const resumable: Contribution | null = pending.data
    ? resumableContribution(pending.data.items, project.id, now)
    : null;
  const resumeUrl = resumable ? safePaymentUrl(resumable.paymentUrl, publicEnv.apiUrl) : null;
  const acceptsLoveMoney = data.kinds.includes('love_money');

  function openJourney(first: string) {
    void setStep(first);
  }

  function openOffline() {
    setOfflineMounted(true);
    setOfflineOpen(true);
  }

  async function cancel(contribution: Contribution) {
    setCanceling(true);
    setCancelError(null);
    try {
      await contributionsControllerCancel(contribution.id);
      await queryClient.invalidateQueries({ queryKey: getContributionsControllerMineQueryKey() });
    } catch (error) {
      setCancelError(problem(error));
    } finally {
      setCanceling(false);
    }
  }

  // The action bar of a phone only opens the journey: the block of the page, shown first on a
  // phone, holds the state, the resumption and the dialogs (one instance of each).
  if (layout === 'bar') {
    return data.availability === 'open' && !resumable ? (
      <Button type="button" onClick={() => openJourney('kind')} data-testid="contribute-bar">
        <HandHeart aria-hidden />
        {t('contribute')}
      </Button>
    ) : null;
  }

  const offlineLink = (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto justify-self-start px-0 text-left whitespace-normal"
      onClick={openOffline}
    >
      {t('declareOffline')}
    </Button>
  );

  return (
    <div className="grid gap-3" data-testid="contribute-entry">
      {resumable ? (
        <Alert
          tone="info"
          title={t('resume.title')}
          action={
            <div className="flex flex-wrap gap-2">
              {resumeUrl ? (
                <Button size="sm" onClick={() => window.location.assign(resumeUrl)}>
                  {t('resume.action')}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                loading={canceling}
                loadingLabel={t('resume.canceling')}
                onClick={() => void cancel(resumable)}
              >
                {t('resume.cancel')}
              </Button>
            </div>
          }
        >
          {t('resume.body', { amount: formatMoney(resumable.amount, locale, 'financial') })}
          {cancelError ? <span className="mt-1 block text-danger">{cancelError}</span> : null}
        </Alert>
      ) : null}
      {data.availability === 'open' ? (
        <>
          {resumable ? null : (
            <Button type="button" className="w-full" onClick={() => openJourney('kind')}>
              <HandHeart aria-hidden />
              {t('contribute')}
            </Button>
          )}
          {offlineLink}
        </>
      ) : (
        <AvailabilityNotice
          availability={data.availability}
          alternatives={
            <div className="grid gap-2">
              {acceptsLoveMoney ? (
                <Button type="button" variant="secondary" onClick={() => openJourney('kind')}>
                  {t('loveMoneyCommitment')}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => void setInterest('1')}>
                {t('interest')}
              </Button>
              {offlineLink}
            </div>
          }
        />
      )}
      {step ? (
        <Suspense fallback={null}>
          <ContributeDialog
            project={project}
            options={data}
            step={step}
            retryOf={from}
            onStep={(next) => void setStep(next)}
            onClose={() => {
              void setStep(null);
              void setFrom(null);
            }}
          />
        </Suspense>
      ) : null}
      {offlineMounted ? (
        <Suspense fallback={null}>
          <DeclareOfflineDialog
            projectId={project.id}
            projectTitle={project.title}
            open={offlineOpen}
            onOpenChange={setOfflineOpen}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

/** The entry with the URL state of its steps (nuqs, mounted by its users, ADR 0094). */
export function ContributeEntry(props: Parameters<typeof Entry>[0]) {
  return (
    <UrlStateProvider>
      <Entry {...props} />
    </UrlStateProvider>
  );
}

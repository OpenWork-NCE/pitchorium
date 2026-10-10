'use client';

import { contributionsControllerCancel } from '@pitchorium/api-client';
import type { Contribution } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { Link, useRouter } from '@/i18n/navigation';
import { publicEnv } from '@/lib/public-env';
import { safePaymentUrl } from '../../lib/payment-url';
import { lockExpired } from '../../lib/status';
import { usePaymentProblem } from '../shared/use-payment-problem';

/**
 * A pending payment: until the end of its session (and of the rate it locked), finish it on the
 * page of its provider or abandon it (`canceled`); after, a new quote that keeps the choices.
 */
export function PendingSession({
  contribution,
  until,
  retry,
}: {
  contribution: Contribution;
  /** End of the session, formatted by the page. */
  until: string;
  /** The journey again with the choices of this contribution. */
  retry: string;
}) {
  const t = useTranslations('web.payments.detail');
  const problem = usePaymentProblem();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = safePaymentUrl(contribution.paymentUrl, publicEnv.apiUrl);
  // The time of the reading: the session of the payment ends at an instant the api gives.
  const [now] = useState(() => Date.now());

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await contributionsControllerCancel(contribution.id);
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }

  if (lockExpired(contribution, now)) {
    return (
      <div
        className="grid gap-3 rounded-2xl border border-border bg-surface p-5"
        data-testid="lock-expired"
      >
        <p className="text-sm">{t('lockExpired')}</p>
        <Button asChild className="justify-self-start">
          <Link href={retry}>{t('newQuote')}</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-surface p-5">
      <p className="text-sm">{t('pendingUntil', { at: until })}</p>
      <div className="flex flex-wrap gap-2">
        {url ? <Button onClick={() => window.location.assign(url)}>{t('resume')}</Button> : null}
        <Button
          variant="ghost"
          loading={busy}
          loadingLabel={t('canceling')}
          onClick={() => void cancel()}
        >
          {t('cancel')}
        </Button>
      </div>
      {error ? (
        <Alert tone="danger" live="alert">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}

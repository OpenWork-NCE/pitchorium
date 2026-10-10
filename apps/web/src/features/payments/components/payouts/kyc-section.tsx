'use client';

import { payoutControllerSubmit } from '@pitchorium/api-client';
import type { KycOverview } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Alert, Badge, Button, Checkbox, FileDrop, Heading } from '@/components/ui';
import { useWithPrerequisites } from '@/features/access';
import { formatDate } from '../../lib/format';
import { PAYMENT_LIMITS } from '../../lib/limits';
import { usePaymentProblem } from '../shared/use-payment-problem';
import { PRIVATE_DOCUMENT_TYPES, usePrivateUploads } from '../shared/use-private-uploads';

const TONES = {
  not_submitted: 'neutral',
  pending: 'info',
  verified: 'success',
  rejected: 'danger',
} as const;

/**
 * The identity check of the holder (§9.5, §13, ADR 0050): checked by the provider (Stripe), or by
 * the manual review of Pitchorium on private documents and a certification; submitted, approved
 * or refused with its reason, then submitted again. Required, with the payout account, before
 * the contributions open online.
 */
export function KycSection({
  overview,
  onSubmitted,
}: {
  overview: KycOverview;
  onSubmitted: (next: KycOverview) => void;
}) {
  const t = useTranslations('web.payments.payouts.kyc');
  const statuses = useTranslations('reference.kycStatuses');
  const locale = useLocale();
  const problem = usePaymentProblem();
  const withPrerequisites = useWithPrerequisites();
  const files = usePrivateUploads(PAYMENT_LIMITS.kycDocuments);
  const [certified, setCertified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(crypto.randomUUID());
  const manual = overview.mode === 'manual_review';
  const canSubmit =
    manual && (overview.status === 'not_submitted' || overview.status === 'rejected');

  async function submit() {
    if (busy || files.ready.length === 0 || !certified) return;
    setBusy(true);
    setError(null);
    try {
      const submission = await withPrerequisites(() =>
        payoutControllerSubmit(
          { documentMediaIds: files.ready, certification: true },
          { headers: { 'Idempotency-Key': key.current } },
        ),
      );
      files.reset();
      setCertified(false);
      key.current = crypto.randomUUID();
      onSubmitted({ mode: overview.mode, status: 'pending', latest: submission });
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="kyc-title" className="grid gap-4" data-testid="kyc-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={2} size="card" id="kyc-title">
          {t('title')}
        </Heading>
        <Badge tone={TONES[overview.status]}>{statuses(overview.status)}</Badge>
      </div>
      <p className="text-sm text-muted">
        {overview.mode === null ? t('noAccount') : t(`${overview.mode}.${overview.status}`)}
      </p>
      {overview.status === 'rejected' && overview.latest?.decisionReason ? (
        <Alert tone="danger" title={t('rejectedTitle')}>
          {overview.latest.decisionReason}
        </Alert>
      ) : null}
      {overview.latest && overview.status !== 'not_submitted' ? (
        <p className="text-xs text-muted">
          {t('submittedAt', { date: formatDate(overview.latest.submittedAt, locale) })}
        </p>
      ) : null}
      {canSubmit ? (
        <div className="grid gap-4">
          <FileDrop
            label={t('documents')}
            limits={t('documentsLimits', { max: PAYMENT_LIMITS.kycDocuments })}
            accept={PRIVATE_DOCUMENT_TYPES}
            multiple
            disabled={files.full}
            items={files.items}
            onFiles={files.add}
            onRemove={files.remove}
            onRetry={files.retry}
          />
          <Checkbox
            checked={certified}
            onCheckedChange={(checked) => setCertified(checked === true)}
            label={t('certification')}
          />
          {error ? (
            <Alert tone="danger" live="alert">
              {error}
            </Alert>
          ) : null}
          <Button
            type="button"
            className="justify-self-start"
            loading={busy}
            loadingLabel={t('submitting')}
            disabledReason={
              files.uploading
                ? t('waitUploads')
                : files.ready.length === 0
                  ? t('documentsRequired')
                  : !certified
                    ? t('certificationRequired')
                    : undefined
            }
            onClick={() => void submit()}
          >
            {t(overview.status === 'rejected' ? 'resubmit' : 'submit')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

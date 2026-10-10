'use client';

import {
  mediaControllerDownload,
  offlineContributionsControllerConfirm,
  offlineContributionsControllerReject,
} from '@pitchorium/api-client';
import type { OfflineContribution, OfflineContributionStatus } from '@pitchorium/contracts';
import { FileText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  Field,
  RelativeTime,
  Textarea,
} from '@/components/ui';
import { formatMoney } from '@/lib/format/money';
import { PAYMENT_LIMITS } from '../../lib/limits';
import { usePaymentProblem } from '../shared/use-payment-problem';

const TONES: Record<OfflineContributionStatus, 'info' | 'accent' | 'success' | 'danger'> = {
  declared: 'info',
  confirmed: 'accent',
  validated: 'success',
  rejected: 'danger',
};

/**
 * An off-platform contribution (§9.3, ADR 0049): its nature, its amount and its EUR equivalent
 * when it carries money, who declared it and its state (declared, confirmed, validated and
 * counted, refused with its reason); its private proofs open by an address signed at the click.
 * The party who did not declare it confirms or refuses it (`canRespond`, given by the list).
 */
export function OfflineItem({
  item,
  canRespond,
  onChanged,
  party,
}: {
  item: OfflineContribution;
  canRespond: boolean;
  onChanged: (next: OfflineContribution) => void;
  /** Who reads: the team of the project or the contributor. */
  party: 'team' | 'contributor';
}) {
  const t = useTranslations('web.payments.offline.item');
  const kinds = useTranslations('reference.offlineContributionKinds');
  const statuses = useTranslations('reference.offlineContributionStatuses');
  const locale = useLocale();
  const problem = usePaymentProblem();
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  async function confirm() {
    setBusy('confirm');
    setError(null);
    try {
      onChanged(await offlineContributionsControllerConfirm(item.id));
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (!reason.trim()) return;
    setBusy('reject');
    setError(null);
    try {
      onChanged(await offlineContributionsControllerReject(item.id, { reason: reason.trim() }));
      setRejecting(false);
      setReason('');
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(null);
    }
  }

  async function openProof(mediaId: string) {
    try {
      const { url } = await mediaControllerDownload(mediaId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (failure) {
      setError(problem(failure));
    }
  }

  const who =
    party === 'team' ? (item.contributor?.displayName ?? t('deletedMember')) : item.project.title;
  return (
    <article
      className="grid gap-3 rounded-xl border border-border bg-surface p-4"
      data-testid="offline-item"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <p className="font-medium">{who}</p>
          <p className="text-sm text-muted">
            {kinds(item.kind)} · {t(`declaredBy.${item.declaredBy}`)} ·{' '}
            <RelativeTime date={item.createdAt} />
          </p>
        </div>
        <Badge tone={TONES[item.status]}>{statuses(item.status)}</Badge>
      </div>
      {item.amount ? (
        <p className="font-numeric tabular-nums">
          {formatMoney(item.amount, locale, 'financial')}
          {item.eurEquivalent && item.eurEquivalent.currency !== item.amount.currency ? (
            <span className="ml-2 text-sm text-muted">
              {t('equivalent', { amount: formatMoney(item.eurEquivalent, locale, 'financial') })}
            </span>
          ) : null}
        </p>
      ) : null}
      {item.description ? <p className="text-sm">{item.description}</p> : null}
      <p className="text-sm text-muted">{t(`states.${item.status}`)}</p>
      {item.status === 'rejected' && item.decisionReason ? (
        <p className="text-sm">{t('reason', { reason: item.decisionReason })}</p>
      ) : null}
      {item.proofMediaIds.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={t('proofs')}>
          {item.proofMediaIds.map((mediaId, index) => (
            <li key={mediaId}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void openProof(mediaId)}
              >
                <FileText aria-hidden />
                {t('proof', { number: index + 1 })}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <Alert tone="danger" live="alert">
          {error}
        </Alert>
      ) : null}
      {canRespond && item.status === 'declared' ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            loading={busy === 'confirm'}
            loadingLabel={t('confirming')}
            onClick={() => void confirm()}
          >
            {t('confirm')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(true)}>
            {t('reject')}
          </Button>
        </div>
      ) : null}
      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent title={t('rejectTitle')} description={t('rejectDescription')} size="sm">
          <Field
            label={t('rejectReason')}
            counter={{ count: reason.length, max: PAYMENT_LIMITS.decisionReason }}
          >
            <Textarea
              value={reason}
              maxLength={PAYMENT_LIMITS.decisionReason}
              rows={3}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setRejecting(false)}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={busy === 'reject'}
              loadingLabel={t('rejecting')}
              disabledReason={reason.trim() ? undefined : t('reasonRequired')}
              onClick={() => void reject()}
            >
              {t('rejectAction')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

'use client';

import {
  adminPaymentsControllerRefund,
  adminPaymentsControllerRefundPreview,
} from '@pitchorium/api-client';
import type { AdminContribution, RefundPreview } from '@pitchorium/contracts';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  DescriptionList,
  EmptyState,
  Field,
  Heading,
  Money,
  MoneyInput,
  Table,
  Text,
  Textarea,
  useAnnounce,
} from '@/components/ui';
import * as routes from '@/config/paths';
import {
  ReauthenticationNotice,
  RecentSessionHint,
  useConsoleAction,
  useConsoleProblem,
  useResumeEffect,
  useSensitiveAction,
} from '@/features/admin';
import { Link, useRouter } from '@/i18n/navigation';
import { formatMoney } from '@/lib/format/money';

/** Longest reason of a refund (DECISION_REASON_MAX_LENGTH of the contracts). */
const REASON_MAX = 1_000;

/**
 * A contribution as an administrator reads it (§9, §13): its state, the quote applied (amount,
 * euro equivalent and its rate, commission, fees), its refunds and the entries of the ledger it
 * wrote; then the refund, total or partial, whose effect the api computes before it is asked
 * (commission given back, euros removed from the project, state that follows), confirmed by a
 * typed phrase and a recent session.
 */
export function AdminContributionDetail({ contribution }: { contribution: AdminContribution }) {
  const t = useTranslations('web.admin.payments.contribution');
  const reference = useTranslations('reference');
  const common = useTranslations('web.admin.common');
  const format = useFormatter();
  const locale = useLocale();
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
  const refund = useConsoleAction('payment.refund');
  // Accounts and kinds of the ledger are open strings of the api: a new one shows as is.
  const kindLabel = (kind: string) =>
    t.has(`ledgerKinds.${kind}` as never) ? t(`ledgerKinds.${kind}` as never) : kind;
  const accountLabel = (account: string) =>
    t.has(`accounts.${account}` as never) ? t(`accounts.${account}` as never) : account;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid content-start gap-6">
        <Card className="grid gap-4 p-5" aria-labelledby="quote-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Heading level={2} size="card" id="quote-title">
              {t('quote')}
            </Heading>
            <Badge tone={contribution.status === 'succeeded' ? 'success' : 'neutral'}>
              {reference(`contributionStatuses.${contribution.status}`)}
            </Badge>
          </div>
          <DescriptionList
            layout="columns"
            items={[
              {
                key: 'amount',
                term: t('amount'),
                description: <Money amount={contribution.amount} precision="financial" />,
              },
              {
                key: 'eur',
                term: t('eurEquivalent'),
                description: <Money amount={contribution.eurEquivalent} precision="financial" />,
              },
              {
                key: 'rate',
                term: t('rate'),
                description: t('rateValue', {
                  units: contribution.rate.unitsPerEur,
                  currency: contribution.amount.currency,
                  source: reference(`fxRateSources.${contribution.rate.source}`),
                }),
              },
              {
                key: 'commission',
                term: t('commission', {
                  rate: format.number(contribution.commissionRateBps / 10_000, {
                    style: 'percent',
                    maximumFractionDigits: 2,
                  }),
                }),
                description: <Money amount={contribution.commission} precision="financial" />,
              },
              {
                key: 'fee',
                term: t('providerFee'),
                description: contribution.providerFee ? (
                  <Money amount={contribution.providerFee} precision="financial" />
                ) : (
                  t('feeUnknown')
                ),
              },
              {
                key: 'refunded',
                term: t('refunded'),
                description: <Money amount={contribution.refunded} precision="financial" />,
              },
              {
                key: 'kind',
                term: t('kind'),
                description: reference(`contributionKinds.${contribution.kind}`),
              },
              {
                key: 'method',
                term: t('method'),
                description: reference(`paymentMethods.${contribution.method}`),
              },
              {
                key: 'reward',
                term: t('reward'),
                description: reference(`rewardReservationStates.${contribution.rewardState}`),
              },
              { key: 'created', term: t('createdAt'), description: date(contribution.createdAt) },
              {
                key: 'succeeded',
                term: t('succeededAt'),
                description: contribution.succeededAt ? date(contribution.succeededAt) : '–',
              },
            ]}
          />
        </Card>
        <Card className="grid gap-3 p-5" aria-labelledby="ledger-title">
          <Heading level={2} size="card" id="ledger-title">
            {t('ledger')}
          </Heading>
          <Text size="sm" tone="muted">
            {t('ledgerHint')}
          </Text>
          {contribution.ledger.length === 0 ? (
            <EmptyState size="inline" title={t('noLedger')} />
          ) : (
            contribution.ledger.map((entry) => (
              <div key={entry.id} className="grid gap-1">
                <p className="flex flex-wrap justify-between gap-2 text-sm font-medium">
                  <span>{kindLabel(entry.kind)}</span>
                  <span className="font-numeric text-muted tabular-nums">
                    {date(entry.occurredAt)}
                  </span>
                </p>
                <Table
                  caption={kindLabel(entry.kind)}
                  hideCaption
                  density="compact"
                  rows={entry.lines}
                  rowKey={(line) => `${line.account}-${line.amount.currency}`}
                  columns={[
                    {
                      key: 'account',
                      header: t('account'),
                      rowHeader: true,
                      cell: (line) => accountLabel(line.account),
                    },
                    {
                      key: 'amount',
                      header: t('lineAmount'),
                      align: 'end',
                      cell: (line) => <Money amount={line.amount} precision="financial" />,
                    },
                  ]}
                />
              </div>
            ))
          )}
        </Card>
        <Card className="grid gap-3 p-5" aria-labelledby="refunds-title">
          <Heading level={2} size="card" id="refunds-title">
            {t('refunds')}
          </Heading>
          {contribution.refunds.length === 0 ? (
            <Text size="sm" tone="muted">
              {t('noRefund')}
            </Text>
          ) : (
            <ul className="grid gap-2">
              {contribution.refunds.map((item) => (
                <li
                  key={item.id}
                  className="grid gap-0.5 rounded-md border border-border p-3 text-sm"
                >
                  <span className="flex flex-wrap justify-between gap-2">
                    <Money amount={item.amount} precision="financial" />
                    <Badge
                      tone={
                        item.status === 'succeeded'
                          ? 'success'
                          : item.status === 'failed'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {reference(`refundStatuses.${item.status}`)}
                    </Badge>
                  </span>
                  <span className="text-muted">
                    {t('refundLine', {
                      date: date(item.createdAt),
                      commission: formatMoney(item.commissionRefunded, locale, 'financial'),
                    })}
                  </span>
                  <span>{item.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div className="grid content-start gap-6">
        <Card className="grid gap-3 p-5" aria-labelledby="parties-title">
          <Heading level={2} size="card" id="parties-title">
            {t('parties')}
          </Heading>
          <DescriptionList
            items={[
              {
                key: 'project',
                term: t('project'),
                description: (
                  <Link
                    href={routes.project(contribution.project.slug)}
                    className="link-underline-hover text-accent"
                  >
                    {contribution.project.title}
                  </Link>
                ),
              },
              {
                key: 'contributor',
                term: t('contributor'),
                description:
                  contribution.contributor?.displayName ??
                  (contribution.anonymous ? t('anonymous') : common('deletedMember')),
              },
              {
                key: 'organization',
                term: t('organization'),
                description: contribution.organization?.title ?? '–',
              },
              {
                key: 'display',
                term: t('publicDisplay'),
                description: contribution.publicDisplay ? common('yes') : common('no'),
              },
            ]}
          />
        </Card>
        {refund.visible &&
        contribution.refundable &&
        contribution.refundable.amountMinor !== '0' ? (
          <RefundPanel contribution={contribution} disabledReason={refund.disabledReason} />
        ) : null}
      </div>
    </div>
  );
}

function RefundPanel({
  contribution,
  disabledReason,
}: {
  contribution: AdminContribution;
  disabledReason: string | undefined;
}) {
  const t = useTranslations('web.admin.payments.refund');
  const reference = useTranslations('reference');
  const common = useTranslations('web.admin.common');
  const locale = useLocale();
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const sensitive = useSensitiveAction(`refund:${contribution.id}`);
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<RefundPreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per intention: a second click or a lost answer never refunds twice.
  const [key, setKey] = useState(() => crypto.randomUUID());
  // Back from the new sign-in: the amount, the reason and the effect are not kept in the browser
  // (no state of a payment there), so the panel asks for them again rather than confirming.
  const [renewed, setRenewed] = useState(false);
  useResumeEffect(sensitive.resumed, () => setRenewed(true), sensitive.acknowledge);
  const requested =
    partial && amount ? { amountMinor: amount, currency: contribution.amount.currency } : undefined;
  const money = (value: { amountMinor: string; currency: string }) =>
    formatMoney(value, locale, 'financial');
  async function computePreview() {
    setBusy(true);
    setError(null);
    try {
      setPreview(
        await adminPaymentsControllerRefundPreview(
          contribution.id,
          requested ? { amount: requested } : {},
        ),
      );
    } catch (failure) {
      setPreview(null);
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    setError(null);
    try {
      const outcome = await sensitive.run(() =>
        adminPaymentsControllerRefund(
          contribution.id,
          { ...(requested ? { amount: requested } : {}), reason: reason.trim() },
          { headers: { 'Idempotency-Key': key } },
        ),
      );
      if (!outcome.done) return;
      setKey(crypto.randomUUID());
      setPreview(null);
      setReason('');
      announce(t('done'));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    }
  }
  return (
    <Card className="grid gap-4 p-5" aria-labelledby="refund-title">
      <Heading level={2} size="card" id="refund-title">
        {t('title')}
      </Heading>
      {contribution.refundable ? (
        <Text size="sm" tone="muted">
          {t('refundable', { amount: money(contribution.refundable) })}
        </Text>
      ) : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('scope')}>
        <Button
          size="sm"
          variant={partial ? 'outline' : 'secondary'}
          aria-pressed={!partial}
          onClick={() => {
            setPartial(false);
            setPreview(null);
          }}
        >
          {t('total')}
        </Button>
        <Button
          size="sm"
          variant={partial ? 'secondary' : 'outline'}
          aria-pressed={partial}
          onClick={() => {
            setPartial(true);
            setPreview(null);
          }}
        >
          {t('partial')}
        </Button>
      </div>
      {partial ? (
        <Field label={t('amount')}>
          <MoneyInput
            currency={contribution.amount.currency}
            value={amount}
            onChange={(value) => {
              setAmount(value);
              setPreview(null);
            }}
          />
        </Field>
      ) : null}
      <Field
        label={t('reason')}
        description={t('reasonHint')}
        counter={{ count: reason.length, max: REASON_MAX }}
      >
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minRows={2}
          maxLength={REASON_MAX}
        />
      </Field>
      <Button
        variant="secondary"
        className="justify-self-start"
        loading={busy}
        loadingLabel={t('computing')}
        disabledReason={partial && !amount ? t('amountMissing') : undefined}
        onClick={() => void computePreview()}
      >
        {t('preview')}
      </Button>
      {preview ? (
        <div className="grid gap-2 rounded-lg bg-surface-sunken p-4 text-sm" aria-live="polite">
          <p className="font-medium">{t('effect')}</p>
          <dl className="grid gap-1">
            {[
              ['refundedAmount', money(preview.amount)],
              ['refundable', money(preview.refundable)],
              ['commissionBack', money(preview.commissionRefunded)],
              ['fundingReversed', money(preview.fundingReversed)],
              ...(preview.project
                ? [
                    ['collectedBefore', money(preview.project.collected)],
                    ['collectedAfter', money(preview.project.collectedAfter)],
                  ]
                : []),
              ['statusAfter', reference(`contributionStatuses.${preview.statusAfter}`)],
              ['rewardReleased', preview.rewardReleased ? common('yes') : common('no')],
            ].map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <dt className="text-muted">{t(`effects.${key}` as never)}</dt>
                <dd className="font-numeric tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
      {renewed ? (
        <p role="status" className="text-sm">
          {t('renewed')}
        </p>
      ) : (
        <RecentSessionHint />
      )}
      {sensitive.stale ? <ReauthenticationNotice resumeKey={`refund:${contribution.id}`} /> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <AlertDialog
        trigger={
          <Button
            variant="danger"
            className="justify-self-start"
            disabledReason={
              disabledReason ??
              (!preview
                ? t('previewFirst')
                : reason.trim().length === 0
                  ? t('reasonMissing')
                  : undefined)
            }
          >
            {t('submit')}
          </Button>
        }
        open={confirming}
        onOpenChange={setConfirming}
        title={t('confirmTitle', { amount: preview ? money(preview.amount) : '' })}
        description={t('confirmDescription')}
        confirmLabel={t('submit')}
        confirmPhrase={t('phrase')}
        onConfirm={submit}
      />
    </Card>
  );
}

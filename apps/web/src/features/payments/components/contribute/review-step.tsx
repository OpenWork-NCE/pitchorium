'use client';

import {
  contributionsControllerCreate,
  contributionsControllerCreateForOrganization,
  offlineContributionsControllerDeclare,
} from '@pitchorium/api-client';
import type { Contribution, ContributionKind, ContributionQuote } from '@pitchorium/contracts';
import { ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  DescriptionList,
  DrawnCheck,
  Field,
  Loading,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { useWithPrerequisites } from '@/features/access';
import { formatDateTimeShort } from '../../lib/format';
import { PAYMENT_LIMITS } from '../../lib/limits';
import { safePaymentUrl } from '../../lib/payment-url';
import { publicEnv } from '@/lib/public-env';
import { formatMoney } from '@/lib/format/money';
import { useMethodLabel } from '../shared/method-label';
import { problemCode, usePaymentProblem } from '../shared/use-payment-problem';
import type { JourneyStep } from '../../lib/journey';
import type { JourneyChoices } from './use-journey';
import { useQuote } from './use-quote';

/** Where a refusal at the payment sends the contributor back to change their choice. */
type RefusalStep = Extract<JourneyStep, 'reward' | 'method' | 'amount'>;
const STEP_OF_REFUSAL: Readonly<Record<string, RefusalStep>> = {
  PROJECTS_REWARD_SOLD_OUT: 'reward',
  PAYMENTS_REWARD_NOT_ELIGIBLE: 'reward',
  PAYMENTS_METHOD_NOT_AVAILABLE: 'method',
  PAYMENTS_CURRENCY_NOT_AVAILABLE: 'amount',
  PAYMENTS_AMOUNT_OUT_OF_RANGE: 'amount',
};

/** The summary of the quote (§9.3 step 7), every amount as the api gives it. */
export function QuoteSummary({ quote }: { quote: ContributionQuote }) {
  const t = useTranslations('web.payments.quote');
  const locale = useLocale();
  const money = (amount: ContributionQuote['amount']) => (
    <span className="font-numeric tabular-nums">{formatMoney(amount, locale, 'financial')}</span>
  );
  const items: { term: ReactNode; description: ReactNode; key: string }[] = [
    { key: 'amount', term: t('amount'), description: money(quote.amount) },
    ...(quote.amount.currency !== 'EUR'
      ? [{ key: 'eur', term: t('eurEquivalent'), description: money(quote.eurEquivalent) }]
      : []),
    {
      key: 'commission',
      term: t('commission', {
        rate: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(
          quote.commissionRateBps / 10_000,
        ),
      }),
      description: money(quote.commission),
    },
    {
      key: 'fee',
      term: t('fee'),
      description: quote.estimatedProviderFee ? money(quote.estimatedProviderFee) : t('feeUnknown'),
    },
    {
      key: 'holder',
      term: t('holder'),
      description: quote.estimatedHolderAmount
        ? money(quote.estimatedHolderAmount)
        : t('holderUnknown'),
    },
    { key: 'currency', term: t('currency'), description: quote.amount.currency },
  ];
  // A floating rate is the one of the moment: its time is said, and the session locks it.
  const floating = quote.rate.source === 'provider' || quote.rate.source === 'simulated';
  return (
    <div className="grid gap-3" data-testid="quote-summary">
      <DescriptionList items={items} />
      {quote.rate.source === 'fixed_parity' ? (
        <p className="text-sm text-muted">
          {t('fixedParity', { rate: quote.rate.unitsPerEur, currency: quote.amount.currency })}
        </p>
      ) : floating ? (
        <p className="text-sm text-muted">
          {t('floatingRate', {
            rate: quote.rate.unitsPerEur,
            currency: quote.amount.currency,
            at: formatDateTimeShort(quote.rate.at, locale),
          })}
        </p>
      ) : null}
    </div>
  );
}

/** The mentions of §9.5 and how the payment works, before the payment. */
export function PaymentMentions({ kind }: { kind: ContributionKind }) {
  const t = useTranslations('web.payments.mentions');
  return (
    <div
      className="grid gap-2 rounded-xl bg-surface-sunken p-4 text-sm"
      data-testid="payment-mentions"
    >
      <p className="flex items-start gap-2">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
        <span>{t('hosted')}</span>
      </p>
      <ul className="grid list-disc gap-1 pl-5 text-muted">
        {kind === 'donation' ? <li>{t('notASecurity')}</li> : null}
        <li>{t('noGuarantee')}</li>
        <li>{t('selfDeclared')}</li>
        <li>{t('notTaxReceipt')}</li>
      </ul>
    </div>
  );
}

/**
 * Step 8: the quote, the mentions, then the payment. The contribution is created with one
 * `Idempotency-Key` per intention (the same choices give the same key), a second click while the
 * first runs does nothing, then the browser goes to the hosted page of the provider: no card
 * number ever reaches Pitchorium (ADR 0136).
 */
export function ReviewStep({
  projectId,
  choices,
  onStep,
}: {
  projectId: string;
  choices: JourneyChoices;
  onStep: (step: JourneyStep) => void;
}) {
  const t = useTranslations('web.payments.journey.review');
  const locale = useLocale();
  const label = useMethodLabel();
  const problem = usePaymentProblem();
  const withPrerequisites = useWithPrerequisites();
  const kind = choices.kind as ContributionKind;
  const quote = useQuote(projectId, {
    kind,
    currency: choices.currency,
    amountMinor: choices.amountMinor,
    rewardId: choices.rewardId,
    method: choices.method,
    country: choices.country,
  });
  const intention = JSON.stringify(choices);
  // One key per intention: a new click with the same choices replays the same request.
  const key = useMemo(() => ({ intention, value: crypto.randomUUID() }), [intention]);
  const paying = useRef(false);
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<{ text: string; step: RefusalStep | null } | null>(null);

  async function pay() {
    if (paying.current) return;
    paying.current = true;
    setBusy(true);
    setRefusal(null);
    const body = {
      kind,
      amount: { amountMinor: choices.amountMinor!, currency: choices.currency! },
      method: choices.method!,
      ...(choices.rewardId ? { rewardId: choices.rewardId } : {}),
      ...(choices.country ? { country: choices.country } : {}),
      publicDisplay: choices.publicDisplay,
      anonymous: choices.anonymous,
    };
    const headers = { 'Idempotency-Key': key.value };
    let contribution: Contribution;
    try {
      contribution = await withPrerequisites<Contribution>(() =>
        choices.organizationId
          ? contributionsControllerCreateForOrganization(
              choices.organizationId,
              { ...body, projectId },
              { headers },
            )
          : contributionsControllerCreate(projectId, body, { headers }),
      );
    } catch (error) {
      const code = problemCode(error);
      setRefusal({ text: problem(error), step: code ? (STEP_OF_REFUSAL[code] ?? null) : null });
      paying.current = false;
      setBusy(false);
      return;
    }
    const url = safePaymentUrl(contribution.paymentUrl, publicEnv.apiUrl);
    if (!url) {
      setRefusal({ text: t('noPaymentPage'), step: null });
      paying.current = false;
      setBusy(false);
      return;
    }
    // The button stays busy: the browser leaves for the page of the provider.
    window.location.assign(url);
  }

  return (
    <div className="grid gap-5">
      {quote.data ? (
        <QuoteSummary quote={quote.data} />
      ) : quote.isError ? (
        <Alert tone="danger" live="alert">
          {problem(quote.error)}
        </Alert>
      ) : (
        <Loading label={t('quoting')}>
          <Skeleton className="h-48 w-full" />
        </Loading>
      )}
      {choices.method ? (
        <p className="text-sm">{t('method', { method: label(choices.method) })}</p>
      ) : null}
      <PaymentMentions kind={kind} />
      {refusal ? (
        <Alert
          tone="danger"
          live="alert"
          action={
            refusal.step ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onStep(refusal.step!)}
              >
                {t(`change.${refusal.step}`)}
              </Button>
            ) : undefined
          }
        >
          {refusal.text}
        </Alert>
      ) : null}
      <Button
        type="button"
        size="lg"
        className="w-full"
        loading={busy}
        loadingLabel={t('paying')}
        disabledReason={quote.data ? undefined : t('waitQuote')}
        onClick={() => void pay()}
        data-testid="pay"
      >
        {quote.data
          ? t('pay', { amount: formatMoney(quote.data.amount, locale, 'financial') })
          : t('payPending')}
      </Button>
    </div>
  );
}

/**
 * A love money commitment without any payment (§9.1, ADR 0049): declared off the platform, then
 * confirmed by the team; it never counts in the collected amount.
 */
export function CommitmentStep({
  projectId,
  onDeclared,
  onDone,
}: {
  projectId: string;
  /** The commitment is recorded: nothing to go back to. */
  onDeclared: () => void;
  onDone: () => void;
}) {
  const t = useTranslations('web.payments.journey.commitment');
  const problem = usePaymentProblem();
  const withPrerequisites = useWithPrerequisites();
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const key = useRef(crypto.randomUUID());

  async function declare() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await withPrerequisites(() =>
        offlineContributionsControllerDeclare(
          projectId,
          {
            kind: 'love_money_commitment',
            ...(description.trim() ? { description: description.trim() } : {}),
          },
          { headers: { 'Idempotency-Key': key.current } },
        ),
      );
      setDone(true);
      onDeclared();
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="grid justify-items-center gap-3 text-center" role="status">
        <DrawnCheck />
        <p className="font-medium">{t('doneTitle')}</p>
        <p className="text-sm text-muted">{t('doneBody')}</p>
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('close')}
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      <p className="text-sm">{t('body')}</p>
      <Field
        label={t('description')}
        optional
        counter={{ count: description.length, max: PAYMENT_LIMITS.offlineDescription }}
      >
        <Textarea
          value={description}
          maxLength={PAYMENT_LIMITS.offlineDescription}
          rows={4}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      {error ? (
        <Alert tone="danger" live="alert">
          {error}
        </Alert>
      ) : null}
      <Button
        type="button"
        loading={busy}
        loadingLabel={t('declaring')}
        onClick={() => void declare()}
      >
        {t('declare')}
      </Button>
    </div>
  );
}

'use client';

import { useProfilesControllerReferenceData } from '@pitchorium/api-client';
import type {
  ContributionKind,
  ContributionQuote,
  FundingInstrument,
  MyOrganization,
  PaymentOptions,
  ProjectReward,
} from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense, useMemo } from 'react';
import {
  Alert,
  Button,
  Callout,
  Checkbox,
  Combobox,
  Field,
  FieldSkeleton,
  MoneyInput,
  RadioGroup,
  Select,
} from '@/components/ui';
import { countryName, countryOptions } from '@/lib/format/countries';
import { formatMoney } from '@/lib/format/money';
import { usePlural } from '@/lib/i18n/plural';
import type { JourneyKind } from '../../lib/journey';
import { availableMethods, unavailableMethods } from '../../lib/methods';
import { useMethodLabel } from '../shared/method-label';
import { UnavailableMethods } from '../shared/unavailable-methods';
import { usePaymentProblem } from '../shared/use-payment-problem';
import type { JourneyChoices } from './use-journey';
import { useQuote } from './use-quote';

/** Instruments of a project that are never paid online (§9.1): an interest, not a payment. */
const NOT_COLLECTED: readonly FundingInstrument[] = [
  'grant',
  'honor_loan',
  'equity',
  'convertible_bonds',
];

interface StepProps {
  choices: JourneyChoices;
  update: (patch: Partial<JourneyChoices>) => void;
}

/** Step 1 (§9.3): what kind of support. */
export function KindStep({
  choices,
  update,
  options,
  instruments,
  onInterest,
}: StepProps & {
  options: PaymentOptions;
  instruments: readonly FundingInstrument[];
  onInterest: () => void;
}) {
  const t = useTranslations('web.payments.journey.kind');
  const kinds = useTranslations('reference.contributionKinds');
  const reference = useTranslations('reference.fundingInstruments');
  const locale = useLocale();
  const open = options.availability === 'open';
  const offered: JourneyKind[] = [
    ...(open ? options.kinds : []),
    ...(options.kinds.includes('love_money') ? (['love_money_commitment'] as const) : []),
  ];
  const interest = instruments.filter((instrument) => NOT_COLLECTED.includes(instrument));
  return (
    <div className="grid gap-5">
      <Field label={t('label')}>
        <RadioGroup
          variant="card"
          value={choices.kind ?? undefined}
          onValueChange={(kind) => update({ kind })}
          options={offered.map((kind) => ({
            value: kind,
            label: kind === 'love_money_commitment' ? t('commitment') : kinds(kind),
            description: t(`descriptions.${kind}`),
          }))}
        />
      </Field>
      {interest.length > 0 ? (
        <Callout title={t('interestTitle')}>
          <p>
            {t('interestBody', {
              instruments: new Intl.ListFormat(locale, { type: 'conjunction' }).format(
                interest.map((instrument) => reference(instrument)),
              ),
            })}
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onInterest}>
            {t('interestAction')}
          </Button>
        </Callout>
      ) : null}
    </div>
  );
}

/** Step 2: the country the contributor pays from, which decides the methods. */
export function CountryStep({ choices, update }: StepProps) {
  const t = useTranslations('web.payments.journey.country');
  const locale = useLocale();
  const reference = useProfilesControllerReferenceData({ query: { staleTime: Infinity } });
  const countries = useMemo(
    () => countryOptions(reference.data?.countries.map(({ code }) => code) ?? [], locale),
    [reference.data, locale],
  );
  return (
    <div className="grid gap-4">
      <Field label={t('label')} description={t('hint')}>
        <Suspense fallback={<FieldSkeleton hint={t('placeholder')} />}>
          <Combobox
            options={countries}
            value={choices.country}
            placeholder={t('placeholder')}
            onValueChange={(country) => update({ country })}
          />
        </Suspense>
      </Field>
    </div>
  );
}

/** The quote's EUR equivalent and rate, as the api gives them: nothing is converted here. */
function Equivalent({ projectId, choices }: { projectId: string; choices: JourneyChoices }) {
  const t = useTranslations('web.payments.journey.amount');
  const locale = useLocale();
  const problem = usePaymentProblem();
  const kind = choices.kind === 'love_money_commitment' ? null : choices.kind;
  const quote = useQuote(projectId, {
    kind,
    currency: choices.currency,
    amountMinor: choices.amountMinor,
    country: choices.country,
  });
  if (!choices.amountMinor) return null;
  if (quote.isError) {
    return (
      <p role="alert" className="text-sm text-danger">
        {problem(quote.error)}
      </p>
    );
  }
  if (!quote.data || choices.currency === 'EUR') return null;
  return (
    <p className="text-sm text-muted tabular-nums" aria-live="polite" data-testid="eur-equivalent">
      {t('equivalent', { amount: formatMoney(quote.data.eurEquivalent, locale, 'financial') })}
      {quote.data.rate.source === 'fixed_parity'
        ? ` ${t('fixedParity', { rate: quote.data.rate.unitsPerEur })}`
        : null}
    </p>
  );
}

/** Step 3: the amount, in the currency of payment the api proposes. */
export function AmountStep({
  choices,
  update,
  options,
  projectId,
}: StepProps & { options: PaymentOptions; projectId: string }) {
  const t = useTranslations('web.payments.journey.amount');
  const locale = useLocale();
  const currencies = options.currencies;
  const currency = currencies.find((entry) => entry.currency === choices.currency) ?? null;
  return (
    <div className="grid gap-4">
      {currencies.length > 1 ? (
        <Field label={t('currency')}>
          <Select
            value={choices.currency ?? undefined}
            onValueChange={(value) => update({ currency: value })}
            options={currencies.map((entry) => ({
              value: entry.currency,
              label:
                new Intl.DisplayNames([locale], { type: 'currency' }).of(entry.currency) ??
                entry.currency,
            }))}
          />
        </Field>
      ) : null}
      {currency ? (
        <Field
          label={t('label')}
          description={t('bounds', {
            min: formatMoney(currency.min, locale),
            max: formatMoney(currency.max, locale),
          })}
        >
          <MoneyInput
            currency={currency.currency}
            value={choices.amountMinor}
            onChange={(amountMinor) => update({ amountMinor })}
          />
        </Field>
      ) : (
        <Alert tone="info">{t('noCurrency')}</Alert>
      )}
      <Equivalent projectId={projectId} choices={choices} />
    </div>
  );
}

/** Step 4: a reward the amount reaches, with its availability (§9.3 step 2). */
export function RewardStep({
  choices,
  update,
  rewards,
  quote,
}: StepProps & {
  rewards: readonly ProjectReward[];
  /** The quote with the reward chosen: the api says whether the amount reaches it. */
  quote: ContributionQuote | undefined;
}) {
  const t = useTranslations('web.payments.journey.reward');
  const locale = useLocale();
  const plural = usePlural();
  const kind = choices.kind as ContributionKind;
  const eligible = rewards.filter((reward) => (reward.instruments as string[]).includes(kind));
  const selected = eligible.find((reward) => reward.id === choices.rewardId) ?? null;
  const belowMinimum = selected && quote?.reward && !quote.reward.eligible;
  return (
    <div className="grid gap-4">
      <Field label={t('label')}>
        <RadioGroup
          variant="card"
          value={choices.rewardId ?? 'none'}
          onValueChange={(value) => update({ rewardId: value === 'none' ? null : value })}
          options={[
            { value: 'none', label: t('none'), description: t('noneHint') },
            ...eligible.map((reward) => ({
              value: reward.id,
              label: reward.title,
              disabled: reward.soldOut,
              description: [
                t('minimum', { amount: formatMoney(reward.minAmount, locale) }),
                reward.soldOut
                  ? t('soldOut')
                  : reward.available === null
                    ? t('unlimited')
                    : t(`remaining.${plural(reward.available)}`, { count: reward.available }),
              ].join(' · '),
            })),
          ]}
        />
      </Field>
      {belowMinimum && selected ? (
        <Alert
          tone="warning"
          live="status"
          action={
            selected.minAmount.currency === choices.currency ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => update({ amountMinor: selected.minAmount.amountMinor })}
              >
                {t('adjust', { amount: formatMoney(selected.minAmount, locale) })}
              </Button>
            ) : undefined
          }
        >
          {t('belowMinimum', { amount: formatMoney(selected.minAmount, locale) })}
        </Alert>
      ) : null}
    </div>
  );
}

/** Step 5: in their own name, or in the name of an organisation they run. */
export function BehalfStep({
  choices,
  update,
  organizations,
  ownName,
}: StepProps & { organizations: readonly MyOrganization[]; ownName: string }) {
  const t = useTranslations('web.payments.journey.behalf');
  return (
    <Field label={t('label')} description={t('hint')}>
      <RadioGroup
        variant="card"
        value={choices.organizationId ?? 'self'}
        onValueChange={(value) => update({ organizationId: value === 'self' ? null : value })}
        options={[
          { value: 'self', label: ownName, description: t('self') },
          ...organizations.map((organization) => ({
            value: organization.id,
            label: organization.name,
            description: t('organization'),
          })),
        ]}
      />
    </Field>
  );
}

/** Step 6: appearing in the public list of supporters, by explicit choice, off by default. */
export function DisplayStep({
  choices,
  update,
  anonymousAllowed,
}: StepProps & { anonymousAllowed: boolean }) {
  const t = useTranslations('web.payments.journey.display');
  return (
    <div className="grid gap-4">
      <Checkbox
        checked={choices.publicDisplay}
        onCheckedChange={(checked) =>
          update({
            publicDisplay: checked === true,
            ...(checked === true ? { anonymous: false } : {}),
          })
        }
        label={t('public')}
        description={t('publicHint')}
      />
      {anonymousAllowed ? (
        <Checkbox
          checked={choices.anonymous}
          onCheckedChange={(checked) =>
            update({
              anonymous: checked === true,
              ...(checked === true ? { publicDisplay: false } : {}),
            })
          }
          label={t('anonymous')}
          description={t('anonymousHint')}
        />
      ) : null}
    </div>
  );
}

/** Step 7: the methods the api offers this contributor, the others with their reason. */
export function MethodStep({
  choices,
  update,
  options,
  loading,
}: StepProps & { options: PaymentOptions; loading: boolean }) {
  const t = useTranslations('web.payments.journey.method');
  const label = useMethodLabel();
  const locale = useLocale();
  const available = availableMethods(options.currencies, choices.currency);
  const notices = unavailableMethods(options.unavailableMethods, available);
  return (
    <div className="grid gap-5" aria-busy={loading || undefined}>
      {available.length > 0 ? (
        <Field label={t('label')}>
          <RadioGroup
            variant="card"
            value={choices.method ?? undefined}
            onValueChange={(method) => update({ method })}
            options={available.map((entry) => ({
              value: entry.method,
              label: label(entry.method, entry.operators),
              description: t(`hints.${entry.method}`),
            }))}
          />
        </Field>
      ) : (
        <Alert tone="info" title={t('noneTitle')}>
          {t('noneBody')}
        </Alert>
      )}
      <UnavailableMethods
        notices={notices}
        available={available}
        country={choices.country ? countryName(choices.country, locale) : null}
      />
    </div>
  );
}

'use client';

import {
  payoutControllerChange,
  payoutControllerCreate,
  useProfilesControllerReferenceData,
} from '@pitchorium/api-client';
import type {
  CreatePayoutAccountRequest,
  PaymentCoverage,
  PayoutAccount,
} from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Combobox,
  DescriptionList,
  Field,
  FieldSkeleton,
  Input,
  RadioGroup,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';
import { countryName, countryOptions } from '@/lib/format/countries';
import { formatList, formatNames } from '@/lib/format/list';
import { payoutCountries, payoutOptions, type PayoutOption } from '../../lib/coverage';
import { maskAccountNumber } from '../../lib/masking';
import { useMethodLabel } from '../shared/method-label';
import { problemCode, usePaymentProblem } from '../shared/use-payment-problem';

type BankAccount = NonNullable<CreatePayoutAccountRequest['bankAccount']>;
const EMPTY_BANK: BankAccount = { bankCode: '', accountNumber: '', accountName: '' };

/** The conditions and documents of an option, translated from their codes (ADR 0139). */
function Eligibility({ option }: { option: PayoutOption }) {
  const t = useTranslations('web.payments.payouts.choice');
  const requirements = useTranslations('reference.payoutRequirements');
  const documents = useTranslations('reference.payoutDocuments');
  const scope = (value: 'all' | 'company') => (value === 'company' ? ` ${t('companyOnly')}` : '');
  const { eligibility } = option.coverage;
  return (
    <div className="grid gap-2 text-sm">
      <p className="font-medium">{t('requirements')}</p>
      <ul className="grid list-disc gap-1 pl-5">
        {eligibility.requirements.map((entry) => (
          <li key={`${entry.code}:${entry.scope}`}>
            {requirements(entry.code)}
            {scope(entry.scope)}
          </li>
        ))}
      </ul>
      {eligibility.documents.length > 0 ? (
        <>
          <p className="font-medium">{t('documents')}</p>
          <ul className="grid list-disc gap-1 pl-5">
            {eligibility.documents.map((entry) => (
              <li key={`${entry.code}:${entry.scope}`}>
                {documents(entry.code)}
                {scope(entry.scope)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/** What contributors can pay with on this option, and what it does not cover. */
function OptionMethods({ option }: { option: PayoutOption }) {
  const t = useTranslations('web.payments.payouts.choice');
  const locale = useLocale();
  const label = useMethodLabel();
  const methods = [
    ...new Map(
      option.methods.map((method) => [
        `${method.method}:${method.operators.join(',')}`,
        method.contributorCountries
          ? t('methodFrom', {
              method: label(method.method, method.operators),
              countries: formatNames(
                method.contributorCountries.map((code) => countryName(code, locale)),
                locale,
              ),
            })
          : label(method.method, method.operators),
      ]),
    ).values(),
  ];
  return (
    <div className="grid gap-2 text-sm">
      <p className="font-medium">{t('contributorsPay')}</p>
      <ul className="grid list-disc gap-1 pl-5">
        {methods.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
      {option.notCovered.length > 0 ? (
        <p className="text-muted">
          {t('notCovered', {
            methods: formatList(
              option.notCovered.map((entry) => label(entry.method, entry.operators)),
              locale,
            ),
          })}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The choice of the payout (ADR 0134, ADR 0139): first the country of the bank account, then the
 * options the coverage serves there, each with the conditions of its provider, what its
 * contributors can pay with and what it does not cover; the holder confirms they meet the
 * conditions, gives the bank details when the provider asks them here, and the api opens (or
 * resumes, or changes to) the account. Nothing is deduced from the country of the profile.
 */
export function PayoutChoice({
  coverage,
  mode,
  current,
  onSaved,
  onCancel,
}: {
  coverage: PaymentCoverage;
  /** `create`: a first account (or the same option resumed); `change`: another option. */
  mode: 'create' | 'change';
  current: PayoutAccount | null;
  onSaved: (account: PayoutAccount) => void;
  onCancel?: () => void;
}) {
  const t = useTranslations('web.payments.payouts.choice');
  const providers = useTranslations('reference.paymentProviders');
  const locale = useLocale();
  const problem = usePaymentProblem();
  const reference = useProfilesControllerReferenceData({ query: { staleTime: Infinity } });
  const countries = useMemo(
    () => countryOptions(reference.data?.countries.map(({ code }) => code) ?? [], locale),
    [reference.data, locale],
  );
  const covered = useMemo(() => payoutCountries(coverage), [coverage]);
  const [country, setCountry] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [bank, setBank] = useState<BankAccount>(EMPTY_BANK);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const key = useRef(crypto.randomUUID());

  const options = country ? payoutOptions(coverage, country) : [];
  const option = options.find((entry) => entry.provider === provider) ?? options[0] ?? null;
  const needsBank = option?.coverage.onboarding === 'bank_details';
  const bankReady =
    !needsBank ||
    (bank.bankCode.trim() !== '' &&
      bank.accountNumber.trim().length >= 4 &&
      bank.accountName.trim() !== '');

  async function submit() {
    if (!option || busy) return;
    setBusy(true);
    setError(null);
    setStale(false);
    const body: CreatePayoutAccountRequest = {
      provider: option.provider,
      country: option.country,
      eligibilityConfirmed: true,
      ...(needsBank
        ? {
            bankAccount: {
              bankCode: bank.bankCode.trim(),
              accountNumber: bank.accountNumber.replace(/\s+/g, ''),
              accountName: bank.accountName.trim(),
              ...(bank.mobileNumber?.trim() ? { mobileNumber: bank.mobileNumber.trim() } : {}),
            },
          }
        : {}),
    };
    const headers = { 'Idempotency-Key': key.current };
    try {
      const account =
        mode === 'change'
          ? await payoutControllerChange(body, { headers })
          : await payoutControllerCreate(body, { headers });
      // The bank details leave the memory of the page as soon as the api has them.
      setBank(EMPTY_BANK);
      key.current = crypto.randomUUID();
      onSaved(account);
    } catch (failure) {
      if (problemCode(failure) === 'ACCESS_REAUTHENTICATION_REQUIRED') setStale(true);
      else setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5" data-testid="payout-choice">
      {mode === 'change' ? (
        <Alert tone="warning" title={t('changeTitle')}>
          <span className="grid gap-1">
            <span>{t('changeNewAccount')}</span>
            <span>{t('changeStripeCountry')}</span>
            <span>{t('changeKept')}</span>
          </span>
        </Alert>
      ) : null}
      <Field label={t('country')} description={t('countryHint')}>
        <Suspense fallback={<FieldSkeleton hint={t('countryPlaceholder')} />}>
          <Combobox
            options={countries}
            value={country}
            placeholder={t('countryPlaceholder')}
            onValueChange={(value) => {
              setCountry(value);
              setProvider(null);
              setConfirmed(false);
              setReviewing(false);
            }}
          />
        </Suspense>
      </Field>
      {country && options.length === 0 ? (
        <Alert
          tone="info"
          title={t('uncoveredTitle', { country: countryName(country, locale) })}
          live="status"
        >
          <span className="grid gap-2">
            <span>{t('uncoveredBody')}</span>
            <span>
              {t('uncoveredOther', {
                countries: formatNames(
                  covered.map((code) => countryName(code, locale)),
                  locale,
                ),
              })}
            </span>
            <span>{t('uncoveredAlternatives')}</span>
          </span>
        </Alert>
      ) : null}
      {options.length > 1 ? (
        <Field label={t('option')}>
          <RadioGroup
            variant="card"
            value={option?.provider}
            onValueChange={(value) => {
              setProvider(value);
              setConfirmed(false);
            }}
            options={options.map((entry) => ({
              value: entry.provider,
              label: providers(entry.provider),
              description: t('settledIn', { currency: entry.currency }),
            }))}
          />
        </Field>
      ) : null}
      {option ? (
        <Card padding="sm" className="grid gap-4" data-testid="payout-option">
          <div className="grid gap-0.5">
            <p className="font-medium">
              {t('optionTitle', {
                provider: providers(option.provider),
                country: countryName(option.country, locale),
              })}
            </p>
            <p className="text-sm text-muted">{t('settledIn', { currency: option.currency })}</p>
          </div>
          <Eligibility option={option} />
          <OptionMethods option={option} />
          {current && current.provider === option.provider && current.country === option.country ? (
            <p className="text-sm text-muted">{t('sameOption')}</p>
          ) : null}
        </Card>
      ) : null}
      {option && needsBank && !reviewing ? (
        <fieldset className="grid gap-4">
          <legend className="mb-2 text-sm font-medium">{t('bank.title')}</legend>
          <p className="text-sm text-muted">{t('bank.privacy')}</p>
          <Field label={t('bank.accountName')}>
            <Input
              value={bank.accountName}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setBank({ ...bank, accountName: event.target.value })}
            />
          </Field>
          <Field label={t('bank.bankCode')} description={t('bank.bankCodeHint')}>
            <Input
              value={bank.bankCode}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setBank({ ...bank, bankCode: event.target.value })}
            />
          </Field>
          <Field label={t('bank.accountNumber')}>
            <Input
              value={bank.accountNumber}
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              onChange={(event) => setBank({ ...bank, accountNumber: event.target.value })}
            />
          </Field>
          <Field label={t('bank.mobileNumber')} description={t('bank.mobileNumberHint')} optional>
            <Input
              value={bank.mobileNumber ?? ''}
              autoComplete="off"
              inputMode="tel"
              onChange={(event) => setBank({ ...bank, mobileNumber: event.target.value })}
            />
          </Field>
        </fieldset>
      ) : null}
      {option && needsBank && reviewing ? (
        <div className="grid gap-2" data-testid="bank-review">
          <p className="text-sm font-medium">{t('bank.review')}</p>
          <DescriptionList
            items={[
              { key: 'name', term: t('bank.accountName'), description: bank.accountName },
              { key: 'code', term: t('bank.bankCode'), description: bank.bankCode },
              {
                key: 'number',
                term: t('bank.accountNumber'),
                description: (
                  <span className="font-numeric">{maskAccountNumber(bank.accountNumber)}</span>
                ),
              },
              ...(bank.mobileNumber?.trim()
                ? [
                    {
                      key: 'mobile',
                      term: t('bank.mobileNumber'),
                      description: (
                        <span className="font-numeric">{maskAccountNumber(bank.mobileNumber)}</span>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <Button
            type="button"
            variant="link"
            size="sm"
            className="justify-self-start px-0"
            onClick={() => setReviewing(false)}
          >
            {t('bank.edit')}
          </Button>
        </div>
      ) : null}
      {option ? (
        <Checkbox
          checked={confirmed}
          onCheckedChange={(checked) => setConfirmed(checked === true)}
          label={t('confirm', {
            provider: providers(option.provider),
            country: countryName(option.country, locale),
          })}
        />
      ) : null}
      {stale ? (
        <Alert
          tone="info"
          live="status"
          title={t('stale.title')}
          action={
            <Button asChild size="sm" variant="outline">
              <Link href={withRedirect(routes.signIn, `/${locale}${routes.settingsPayouts}`)}>
                {t('stale.action')}
              </Link>
            </Button>
          }
        >
          {t('stale.body')}
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="danger" live="alert">
          {error}
        </Alert>
      ) : null}
      {option ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t('cancel')}
            </Button>
          ) : null}
          {needsBank && !reviewing ? (
            <Button
              type="button"
              disabledReason={
                !bankReady ? t('bank.incomplete') : !confirmed ? t('confirmFirst') : undefined
              }
              onClick={() => setReviewing(true)}
            >
              {t('bank.continue')}
            </Button>
          ) : (
            <Button
              type="button"
              loading={busy}
              loadingLabel={t('saving')}
              disabledReason={confirmed ? undefined : t('confirmFirst')}
              onClick={() => void submit()}
            >
              {t(mode === 'change' ? 'submitChange' : 'submit')}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

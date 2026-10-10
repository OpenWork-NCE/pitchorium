'use client';

import { payoutControllerKyc, payoutControllerRefresh } from '@pitchorium/api-client';
import type { KycOverview, PaymentCoverage, PayoutAccount } from '@pitchorium/contracts';
import { ExternalLink } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, DescriptionList, Heading } from '@/components/ui';
import { countryName } from '@/lib/format/countries';
import { publicEnv } from '@/lib/public-env';
import { safePaymentUrl } from '../../lib/payment-url';
import { usePaymentProblem } from '../shared/use-payment-problem';
import { CoverageOverview } from './coverage-overview';
import { KycSection } from './kyc-section';
import { PayoutChoice } from './payout-choice';

const STATUS_TONES = { pending: 'info', active: 'success', restricted: 'warning' } as const;

/** The payout account of the holder and where it stands, with its next action. */
function AccountCard({
  account,
  onChange,
  onRefreshed,
}: {
  account: PayoutAccount;
  onChange: () => void;
  onRefreshed: (account: PayoutAccount) => void;
}) {
  const t = useTranslations('web.payments.payouts.account');
  const providers = useTranslations('reference.paymentProviders');
  const statuses = useTranslations('reference.payoutAccountStatuses');
  const refusals = useTranslations('web.payments.problems.PAYMENTS_PAYOUT_CHANGE_REFUSED');
  const locale = useLocale();
  const problem = usePaymentProblem();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onboarding = safePaymentUrl(account.onboardingUrl, publicEnv.apiUrl);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      onRefreshed(await payoutControllerRefresh());
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Card className="grid gap-4" data-testid="payout-account">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading level={2} size="card">
          {t('title')}
        </Heading>
        <Badge tone={STATUS_TONES[account.status]}>{statuses(account.status)}</Badge>
      </div>
      <DescriptionList
        items={[
          { key: 'provider', term: t('provider'), description: providers(account.provider) },
          { key: 'country', term: t('country'), description: countryName(account.country, locale) },
          { key: 'currency', term: t('currency'), description: account.currency },
        ]}
      />
      {account.collectionOpen ? (
        <Alert tone="success" title={t('openTitle')}>
          {t('openBody')}
        </Alert>
      ) : !account.covered ? (
        <Alert tone="warning" title={t('notCoveredTitle')}>
          {t('notCoveredBody')}
        </Alert>
      ) : (
        <Alert tone="info" title={t('pendingTitle')}>
          {t(account.kyc.status === 'verified' ? 'pendingAccount' : 'pendingKyc')}
        </Alert>
      )}
      {error ? (
        <Alert tone="danger" live="alert">
          {error}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {onboarding ? (
          <Button onClick={() => window.location.assign(onboarding)}>
            <ExternalLink aria-hidden />
            {t('continueOnboarding')}
          </Button>
        ) : null}
        {account.onboarding === 'hosted' ? (
          <Button
            variant="outline"
            loading={refreshing}
            loadingLabel={t('refreshing')}
            onClick={() => void refresh()}
          >
            {t('refresh')}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          disabledReason={account.changeRefusal ? refusals(account.changeRefusal) : undefined}
          onClick={onChange}
        >
          {t('change')}
        </Button>
      </div>
      {account.changeRefusal && account.changeRefusal !== 'same_option' ? (
        <p className="text-sm text-muted">{refusals(account.changeRefusal)}</p>
      ) : null}
    </Card>
  );
}

/**
 * « Versement et vérification » (§9.5, §13, ADR 0139): the coverage and its principle (the
 * country of the payout account decides, not the country of residence nor of the project), the
 * account of the holder, the choice or the change of the payout option, and the identity check.
 * Every state comes from the api; the bank details stay in the memory of the form only.
 */
export function PayoutSettings({
  coverage,
  initialAccount,
  initialKyc,
}: {
  coverage: PaymentCoverage;
  initialAccount: PayoutAccount | null;
  initialKyc: KycOverview | null;
}) {
  const t = useTranslations('web.payments.payouts');
  const [account, setAccount] = useState(initialAccount);
  const [kyc, setKyc] = useState(initialKyc);
  const [changing, setChanging] = useState(false);
  const refreshed = useRef(false);

  // Back from a hosted onboarding (Stripe): the state is read again at the provider, once.
  useEffect(() => {
    if (
      refreshed.current ||
      !account ||
      account.onboarding !== 'hosted' ||
      account.status === 'active'
    ) {
      return;
    }
    refreshed.current = true;
    void payoutControllerRefresh().then(setAccount, () => undefined);
  }, [account]);

  async function saved(next: PayoutAccount) {
    setAccount(next);
    setChanging(false);
    setKyc(await payoutControllerKyc().catch(() => kyc));
  }

  return (
    <div className="grid gap-6 *:min-w-0">
      <Card className="grid gap-4">
        <CoverageOverview coverage={coverage} />
      </Card>
      {account && !changing ? (
        <AccountCard
          account={account}
          onChange={() => setChanging(true)}
          onRefreshed={setAccount}
        />
      ) : (
        <Card className="grid gap-4">
          <div className="grid gap-1">
            <Heading level={2} size="card">
              {t(account ? 'changeTitle' : 'chooseTitle')}
            </Heading>
            <p className="text-sm text-muted">{t('chooseDescription')}</p>
          </div>
          <PayoutChoice
            coverage={coverage}
            mode={account ? 'change' : 'create'}
            current={account}
            onSaved={(next) => void saved(next)}
            {...(account ? { onCancel: () => setChanging(false) } : {})}
          />
        </Card>
      )}
      {kyc ? (
        <Card className="grid gap-4">
          <KycSection overview={kyc} onSubmitted={setKyc} />
        </Card>
      ) : null}
    </div>
  );
}

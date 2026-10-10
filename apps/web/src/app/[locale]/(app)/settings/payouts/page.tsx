import {
  accessControllerPrerequisites,
  coverageControllerRead,
  payoutControllerAccount,
  payoutControllerKyc,
} from '@pitchorium/api-client';
import type { KycOverview, PayoutAccount } from '@pitchorium/contracts';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PayoutSettings, PayoutsUnavailable } from '@/features/payments';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.settings.sections');
  return { title: t('payouts'), robots: { index: false, follow: false } };
}

/**
 * « Versement et vérification » (§9.5, §13): the coverage, the payout account and the identity
 * check of a holder. A member who misses what the api requires first (an entrepreneur facet, a
 * verified address) reads what to complete; the api decides each action.
 */
export default async function Page({ params }: PageProps<'/[locale]/settings/payouts'>) {
  setRequestLocale(asLocale((await params).locale));
  configureServerApi();
  const [coverage, prerequisites] = await Promise.all([
    coverageControllerRead({ cache: 'no-store' }),
    accessControllerPrerequisites('payment.payout.configure', { cache: 'no-store' }),
  ]);
  if (prerequisites.missing.length > 0) {
    return <PayoutsUnavailable missing={prerequisites.missing} />;
  }
  const [account, kyc] = await Promise.all([
    // No account yet: the api answers 404 (PAYMENTS_PAYOUT_ACCOUNT_NOT_FOUND).
    payoutControllerAccount({ cache: 'no-store' }).catch((): PayoutAccount | null => null),
    payoutControllerKyc({ cache: 'no-store' }).catch((): KycOverview | null => null),
  ]);
  return <PayoutSettings coverage={coverage} initialAccount={account} initialKyc={kyc} />;
}

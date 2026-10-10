'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { PrerequisiteForms } from '@/features/access';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';

/**
 * The payout account and the identity check cannot be completed inside a dialog (a provider's
 * pages, private documents): their prerequisite says what they are and leads to « Versement et
 * vérification » (ADR 0105).
 */
function PayoutSettingsLink({ element }: { element: 'payout_account' | 'kyc_verified' }) {
  const t = useTranslations('web.payments.prerequisites');
  return (
    <div className="grid gap-3">
      <p className="text-sm">{t(element)}</p>
      <Button asChild className="justify-self-start">
        <Link href={routes.settingsPayouts}>{t('action')}</Link>
      </Button>
    </div>
  );
}

export const PAYMENTS_PREREQUISITE_FORMS: PrerequisiteForms = {
  payout_account: () => <PayoutSettingsLink element="payout_account" />,
  kyc_verified: () => <PayoutSettingsLink element="kyc_verified" />,
};

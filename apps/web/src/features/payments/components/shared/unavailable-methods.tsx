'use client';

import type { PaymentMethod, PaymentUnavailableReason } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { formatList } from '@/lib/format/list';
import type { AvailableMethod } from '../../lib/methods';
import { useMethodLabel } from './method-label';

/**
 * The methods the contributor cannot use here, said soberly with their reason (ADR 0135, ADR
 * 0138), followed by what they can use: « Mobile Money n'est pas disponible depuis votre pays ;
 * la carte bancaire est acceptée. » The reasons are the api's, translated; nothing is guessed.
 */
export function UnavailableMethods({
  notices,
  available,
  country,
}: {
  notices: readonly { method: PaymentMethod; reason: PaymentUnavailableReason }[];
  available: readonly AvailableMethod[];
  /** Name of the country of the contributor, for the reason that depends on it. */
  country: string | null;
}) {
  const t = useTranslations('web.payments.unavailable');
  const label = useMethodLabel();
  const locale = useLocale();
  if (notices.length === 0) return null;
  const accepted = formatList(
    available.map((entry) => label(entry.method)),
    locale,
  );
  return (
    <div className="grid gap-1.5" data-testid="unavailable-methods">
      <p className="text-sm font-medium">{t('title')}</p>
      <ul className="grid gap-1.5 text-sm text-muted">
        {notices.map((notice) => (
          <li key={notice.method}>
            {t(`reasons.${notice.reason}`, {
              method: label(notice.method),
              country: country ?? t('yourCountry'),
            })}
          </li>
        ))}
      </ul>
      <p className="text-sm">
        {available.length > 0 ? t('accepted', { methods: accepted }) : t('noneAvailable')}
      </p>
    </div>
  );
}

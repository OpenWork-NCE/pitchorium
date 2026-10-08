'use client';

import type { MoneyDto } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format/money';

interface MoneyProps {
  amount: MoneyDto;
  /** Equivalent in euros frozen by the api (contributions in another currency). */
  euroEquivalent?: MoneyDto | null;
  className?: string;
}

/**
 * An amount of the api (minor units and currency), with the decimals of its currency (XAF none)
 * and, when it is not in euros, its equivalent frozen by the api: shown, never computed here.
 */
export function Money({ amount, euroEquivalent, className }: MoneyProps) {
  const locale = useLocale();
  const t = useTranslations('web.ui.money');
  const format = (money: MoneyDto) => formatMoney(money, locale);
  return (
    <span className={cn('tabular-nums', className)}>
      <span className="font-medium">{format(amount)}</span>
      {euroEquivalent && euroEquivalent.currency !== amount.currency ? (
        <span className="ml-1.5 text-sm text-muted">
          {t('equivalent', { amount: format(euroEquivalent) })}
        </span>
      ) : null}
    </span>
  );
}

'use client';

import type { MobileMoneyOperator, PaymentMethod } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { formatNames } from '@/lib/format/list';

/**
 * A payment method in words, with its operators for mobile money (« Mobile Money : Orange Money
 * et Wave »): codes of the api labelled by `reference`. No logo of an operator: their brand rules
 * are not verified (question 124), and the name says it all.
 */
export function useMethodLabel(): (
  method: PaymentMethod,
  operators?: readonly MobileMoneyOperator[],
) => string {
  const methods = useTranslations('reference.paymentMethods');
  const names = useTranslations('reference.mobileMoneyOperators');
  const t = useTranslations('web.payments.methods');
  const locale = useLocale();
  return (method, operators = []) =>
    operators.length > 0
      ? t('withOperators', {
          method: methods(method),
          operators: formatNames(
            operators.map((operator) => names(operator)),
            locale,
          ),
        })
      : methods(method);
}

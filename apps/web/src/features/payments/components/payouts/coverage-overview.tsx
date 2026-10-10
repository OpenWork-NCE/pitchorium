'use client';

import type { PaymentCoverage } from '@pitchorium/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { Card, Heading } from '@/components/ui';
import { countryName } from '@/lib/format/countries';
import { formatList, formatNames } from '@/lib/format/list';
import { formatDate } from '../../lib/format';
import { useMethodLabel } from '../shared/method-label';

/**
 * The verified coverage of the payments, readable (ADR 0133, ADR 0139): for each payout option,
 * the countries an account may be opened in, its currencies and what its contributors can pay
 * with. Read from the public coverage of the api, never copied: an option the api drops leaves
 * the page with it.
 */
export function CoverageOverview({ coverage }: { coverage: PaymentCoverage }) {
  const t = useTranslations('web.payments.payouts.coverage');
  const providers = useTranslations('reference.paymentProviders');
  const locale = useLocale();
  const label = useMethodLabel();
  return (
    <section aria-labelledby="coverage-title" className="grid gap-4">
      <div className="grid gap-1">
        <Heading level={2} size="card" id="coverage-title">
          {t('title')}
        </Heading>
        <p className="text-sm text-muted">{t('principle')}</p>
      </div>
      {coverage.providers.length === 0 ? (
        <p className="text-sm">{t('none')}</p>
      ) : (
        <ul className="grid gap-3">
          {coverage.providers.map((provider) => {
            const methods = [
              ...new Map(
                provider.payments.map((payment) => [
                  `${payment.method}:${payment.operators.join(',')}`,
                  label(payment.method, payment.operators),
                ]),
              ).values(),
            ];
            return (
              <li key={provider.provider}>
                <Card padding="sm" className="grid gap-2" data-testid="coverage-option">
                  <p className="font-medium">{providers(provider.provider)}</p>
                  <p className="text-sm">
                    {t('countries', {
                      countries: formatNames(
                        provider.payoutCountries.map(({ country }) => countryName(country, locale)),
                        locale,
                      ),
                    })}
                  </p>
                  <p className="text-sm text-muted">
                    {t('currencies', {
                      currencies: formatNames(provider.payoutCurrencies, locale),
                    })}
                  </p>
                  <p className="text-sm text-muted">
                    {t('methods', { methods: formatList(methods, locale) })}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted">
        {t('verified', {
          version: coverage.matrixVersion,
          date: formatDate(coverage.verifiedAt, locale),
        })}
      </p>
    </section>
  );
}

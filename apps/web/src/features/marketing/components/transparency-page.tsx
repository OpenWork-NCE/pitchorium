import type { PaymentCoverage } from '@pitchorium/contracts';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Container } from '@/components/layout/container';
import { SplitHeading } from '@/components/motion/split-heading';
import { Heading, Text } from '@/components/ui';
import * as routes from '@/config/paths';
import { countryNames } from '@/features/projects';
import { Link } from '@/i18n/navigation';
import { formatNames } from '@/lib/format/list';
import { EditorialHeader } from './editorial-header';

const STATEMENTS = ['fees', 'funds', 'title', 'tax'] as const;

/**
 * Transparency and fees (§9.3 to §9.5, ADR 0156): the commission in force and the coverage of
 * the payments, read from the public route of the api (never a rule of the web), the fees of the
 * providers, the funds never held, the self-declared impact, what a contribution is not. The
 * providers are never named (ADR 0136): the coverage is shown as one list.
 */
export function TransparencyPage({ coverage }: { coverage: PaymentCoverage | null }) {
  const t = useTranslations('web.marketing.transparency');
  const methods = useTranslations('reference.paymentMethods');
  const format = useFormatter();
  const locale = useLocale();
  const payoutCountries = coverage
    ? [...new Set(coverage.providers.flatMap((p) => p.payoutCountries.map((c) => c.country)))]
    : [];
  const paymentMethods = coverage
    ? [...new Set(coverage.providers.flatMap((p) => p.payments.map((payment) => payment.method)))]
    : [];
  const countries = countryNames(payoutCountries, locale).sort((a, b) =>
    a.localeCompare(b, locale),
  );
  return (
    <>
      <EditorialHeader title={t('title')} lede={t('lede')} />
      <Container className="grid gap-12 py-16 md:py-24 [&>section]:max-w-3xl">
        <section aria-labelledby="commission" className="grid gap-3">
          <SplitHeading
            id="commission"
            className="font-display text-2xl font-extrabold text-balance"
          >
            {t('commissionTitle')}
          </SplitHeading>
          <Text data-commission-rate={coverage?.commission.rateBps}>
            {coverage
              ? t('commissionBody', {
                  rate: format.number(coverage.commission.rateBps / 10_000, {
                    style: 'percent',
                    maximumFractionDigits: 2,
                  }),
                })
              : t('commissionUnavailable')}
          </Text>
        </section>
        {STATEMENTS.map((statement) => (
          <section key={statement} aria-labelledby={statement} className="grid gap-3">
            <Heading level={2} id={statement}>
              {t(`${statement}Title`)}
            </Heading>
            <Text>{t(`${statement}Body`)}</Text>
          </section>
        ))}
        <section aria-labelledby="impact" className="grid gap-3">
          <Heading level={2} id="impact">
            {t('impactTitle')}
          </Heading>
          <Text>{t('impactBody')}</Text>
          <Link
            href={routes.impactMethodology}
            className="w-fit link-underline-hover text-accent underline"
          >
            {t('impactLink')}
          </Link>
        </section>
        <section aria-labelledby="coverage" className="grid gap-6" data-coverage="">
          <div className="grid gap-3">
            <SplitHeading
              id="coverage"
              className="font-display text-2xl font-extrabold text-balance"
            >
              {t('coverageTitle')}
            </SplitHeading>
            <Text tone="muted">
              {coverage
                ? t('coverageBody', {
                    date: format.dateTime(new Date(`${coverage.verifiedAt}T00:00:00Z`), {
                      dateStyle: 'long',
                      timeZone: 'UTC',
                    }),
                  })
                : t('coverageUnavailable')}
            </Text>
          </div>
          {coverage ? (
            <dl className="grid gap-6 md:grid-cols-2">
              <div className="grid content-start gap-2">
                <dt className="font-semibold">{t('payoutCountries')}</dt>
                <dd className="text-muted">{formatNames(countries, locale)}</dd>
              </div>
              <div className="grid content-start gap-2">
                <dt className="font-semibold">{t('methods')}</dt>
                <dd className="text-muted">
                  {formatNames(
                    paymentMethods.map((method) => methods(method)),
                    locale,
                  )}
                </dd>
              </div>
            </dl>
          ) : null}
        </section>
      </Container>
    </>
  );
}

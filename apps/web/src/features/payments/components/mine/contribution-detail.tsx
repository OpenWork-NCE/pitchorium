import type { Contribution } from '@pitchorium/contracts';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Badge, Button, DescriptionList, Heading, Link, Notice } from '@/components/ui';
import { routes } from '@/config/routes';
import { formatMoney } from '@/lib/format/money';
import { formatDateTimeShort } from '../../lib/format';
import { statusTone } from '../../lib/status';
import { PendingSession } from './pending-actions';

/**
 * A contribution of the member (§9.4): the quote the api applied (amount, currency, EUR
 * equivalent and the rate frozen with its source, commission, fees once known, refunds), its
 * status and its reward; « pas un reçu fiscal ». A pending payment shows the rate it locked
 * until the end of its session, with the way to finish or abandon it; once that session is over,
 * a new quote is asked.
 */
export async function ContributionDetail({ contribution }: { contribution: Contribution }) {
  const t = await getTranslations('web.payments.detail');
  const statuses = await getTranslations('reference.contributionStatuses');
  const kinds = await getTranslations('reference.contributionKinds');
  const methods = await getTranslations('reference.paymentMethods');
  const states = await getTranslations('web.payments.rewardStates');
  const locale = await getLocale();
  const money = (amount: Contribution['amount']) => (
    <span className="font-numeric tabular-nums">{formatMoney(amount, locale, 'financial')}</span>
  );
  const rateSource = contribution.rate.source;
  const items: { key: string; term: ReactNode; description: ReactNode }[] = [
    { key: 'kind', term: t('kind'), description: kinds(contribution.kind) },
    { key: 'method', term: t('method'), description: methods(contribution.method) },
    { key: 'amount', term: t('amount'), description: money(contribution.amount) },
    { key: 'currency', term: t('currency'), description: contribution.amount.currency },
    { key: 'eur', term: t('eurEquivalent'), description: money(contribution.eurEquivalent) },
    {
      key: 'rate',
      term: t('rate'),
      description:
        rateSource === 'identity'
          ? t('rateIdentity')
          : t(`rate_${rateSource}`, {
              rate: contribution.rate.unitsPerEur,
              currency: contribution.amount.currency,
              at: formatDateTimeShort(contribution.rate.at, locale),
            }),
    },
    { key: 'commission', term: t('commission'), description: money(contribution.commission) },
    {
      key: 'fee',
      term: t('fee'),
      description: contribution.providerFee ? money(contribution.providerFee) : t('feeUnknown'),
    },
    ...(contribution.refunded.amountMinor === '0'
      ? []
      : [{ key: 'refunded', term: t('refunded'), description: money(contribution.refunded) }]),
    ...(contribution.rewardId
      ? [{ key: 'reward', term: t('reward'), description: states(contribution.rewardState) }]
      : []),
    {
      key: 'display',
      term: t('display'),
      description: t(
        contribution.anonymous ? 'anonymous' : contribution.publicDisplay ? 'public' : 'private',
      ),
    },
    {
      key: 'date',
      term: t('date'),
      description: formatDateTimeShort(contribution.succeededAt ?? contribution.createdAt, locale),
    },
  ];
  return (
    <article className="grid gap-6" aria-labelledby="contribution-title">
      <div className="grid gap-2">
        <Link href={routes.dashboard} variant="standalone" className="text-sm">
          {t('back')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Heading level={1} size="page" id="contribution-title">
            {t('title', { title: contribution.project.title })}
          </Heading>
          <Badge tone={statusTone(contribution.status)}>{statuses(contribution.status)}</Badge>
        </div>
        <p className="text-sm text-muted">{t(`status.${contribution.status}`)}</p>
      </div>
      {contribution.status === 'pending_payment' ? (
        <PendingSession
          contribution={contribution}
          until={formatDateTimeShort(contribution.expiresAt, locale)}
          retry={`${routes.project(contribution.project.slug)}?contribute=review&from=${contribution.id}`}
        />
      ) : null}
      <DescriptionList items={items} />
      <Notice kind="notTaxReceipt" />
      <Button asChild variant="ghost" className="justify-self-start">
        <Link href={routes.project(contribution.project.slug)}>{t('project')}</Link>
      </Button>
    </article>
  );
}

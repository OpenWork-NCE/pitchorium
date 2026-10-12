'use client';

import {
  adminPaymentsControllerDecideOffline,
  adminPaymentsControllerOfflineQueue,
} from '@pitchorium/api-client';
import type { CursorPage, OfflineContribution } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DescriptionList,
  EmptyState,
  Heading,
  Money,
  Text,
  useAnnounce,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { PrivateDocuments, useConsoleAction, useConsoleProblem } from '@/features/admin';
import { Link, useRouter } from '@/i18n/navigation';
import { DecisionPanel } from './decision-panel';

/**
 * The off-platform contributions waiting for a validation on proof (§9.3): declared by the
 * contributor or the holder, confirmed by the other party, then validated or refused here with
 * a reason; a validated amount enters the collected amount of the project.
 */
export function OfflineReview({ page }: { page: CursorPage<OfflineContribution> }) {
  const t = useTranslations('web.admin.payments.offline');
  const common = useTranslations('web.admin.common');
  const problem = useConsoleProblem();
  const [items, setItems] = useState(page.items);
  const [cursor, setCursor] = useState(page.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function more() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const next = await adminPaymentsControllerOfflineQueue({
        status: 'confirmed',
        cursor,
        limit: 20,
      });
      setItems((current) => [...current, ...next.items]);
      setCursor(next.nextCursor);
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setLoading(false);
    }
  }
  if (items.length === 0) {
    return <EmptyState title={t('empty')} description={t('emptyHint')} />;
  }
  return (
    <div className="grid gap-4">
      <ul className="grid gap-4">
        {items.map((item) => (
          <li key={item.id}>
            <OfflineItem item={item} />
          </li>
        ))}
      </ul>
      {cursor ? (
        <Button
          variant="outline"
          className="justify-self-center"
          loading={loading}
          loadingLabel={common('loadMore')}
          onClick={() => void more()}
        >
          {common('loadMore')}
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function OfflineItem({ item }: { item: OfflineContribution }) {
  const t = useTranslations('web.admin.payments.offline');
  const reference = useTranslations('reference');
  const common = useTranslations('web.admin.common');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const validate = useConsoleAction('payment.offline.validate');
  const [error, setError] = useState<string | null>(null);
  const titleId = `offline-${item.id}`;
  async function decide(decision: 'validated' | 'rejected', reason: string) {
    setError(null);
    try {
      await adminPaymentsControllerDecideOffline(item.id, { decision, reason });
      announce(t(decision === 'validated' ? 'validatedDone' : 'rejectedDone'));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    }
  }
  return (
    <Card
      className="grid gap-4 p-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
      aria-labelledby={titleId}
    >
      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Heading level={2} size="card" id={titleId}>
            <Link href={routes.project(item.project.slug)} className="link-underline-hover">
              {item.project.title}
            </Link>
          </Heading>
          <Badge tone="warning">{reference(`offlineContributionStatuses.${item.status}`)}</Badge>
        </div>
        <DescriptionList
          items={[
            {
              key: 'kind',
              term: t('kind'),
              description: reference(`offlineContributionKinds.${item.kind}`),
            },
            {
              key: 'amount',
              term: t('amount'),
              description: item.amount ? (
                <Money
                  amount={item.amount}
                  euroEquivalent={item.eurEquivalent}
                  precision="financial"
                />
              ) : (
                t('noAmount')
              ),
            },
            {
              key: 'contributor',
              term: t('contributor'),
              description: item.contributor?.displayName ?? common('deletedMember'),
            },
            {
              key: 'declaredBy',
              term: t('declaredBy'),
              description: t(`declarers.${item.declaredBy}`),
            },
            {
              key: 'dates',
              term: t('dates'),
              description: t('datesValue', {
                declared: format.dateTime(new Date(item.createdAt), { dateStyle: 'medium' }),
                confirmed: item.confirmedAt
                  ? format.dateTime(new Date(item.confirmedAt), { dateStyle: 'medium' })
                  : common('none'),
              }),
            },
          ]}
        />
        {item.description ? (
          <p className="text-sm whitespace-pre-line">{item.description}</p>
        ) : null}
        <div className="grid gap-2">
          <Text size="sm" weight="medium">
            {t('proofs')}
          </Text>
          <PrivateDocuments mediaIds={item.proofMediaIds} />
        </div>
      </div>
      {validate.visible ? (
        <div className="grid content-start gap-3">
          <DecisionPanel
            approve="validated"
            reject="rejected"
            labels={{
              approve: t('validate'),
              approveHint: item.amount ? t('validateHint') : t('validateHintNoMoney'),
              reject: t('reject'),
              rejectHint: t('rejectHint'),
            }}
            disabledReason={validate.disabledReason}
            onDecide={decide}
          />
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

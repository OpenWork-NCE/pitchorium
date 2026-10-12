'use client';

import { adminPaymentsControllerDecideKyc } from '@pitchorium/api-client';
import type { KycSubmission } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge, Card, DescriptionList, Heading, Text, useAnnounce } from '@/components/ui';
import * as routes from '@/config/paths';
import { PrivateDocuments, useConsoleAction, useConsoleProblem } from '@/features/admin';
import { Link, useRouter } from '@/i18n/navigation';
import { DecisionPanel } from './decision-panel';

/**
 * The review of an identity verification (§9.5, manual mode): the documents opened by a signed
 * address, then an approval (the contributions of the holder may open) or a refusal with its
 * reason, sent to the holder.
 */
export function KycReview({ submission }: { submission: KycSubmission }) {
  const t = useTranslations('web.admin.payments.kyc');
  const reference = useTranslations('reference');
  const common = useTranslations('web.admin.common');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const review = useConsoleAction('payment.kyc.review');
  const [error, setError] = useState<string | null>(null);
  async function decide(decision: 'approved' | 'rejected', reason: string) {
    setError(null);
    try {
      await adminPaymentsControllerDecideKyc(submission.id, { decision, reason });
      announce(t(decision === 'approved' ? 'approvedDone' : 'rejectedDone'));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid content-start gap-6">
        <Card className="grid gap-3 p-5" aria-labelledby="kyc-documents">
          <Heading level={2} size="card" id="kyc-documents">
            {t('documents')}
          </Heading>
          <PrivateDocuments mediaIds={submission.documentMediaIds} />
        </Card>
        {submission.status === 'pending' && review.visible ? (
          <Card className="grid gap-4 p-5" aria-labelledby="kyc-decide">
            <Heading level={2} size="card" id="kyc-decide">
              {t('decide')}
            </Heading>
            <DecisionPanel
              approve="approved"
              reject="rejected"
              labels={{
                approve: t('approve'),
                approveHint: t('approveHint'),
                reject: t('reject'),
                rejectHint: t('rejectHint'),
              }}
              disabledReason={review.disabledReason}
              onDecide={decide}
            />
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
          </Card>
        ) : null}
      </div>
      <div className="grid content-start gap-6">
        <Card className="grid gap-3 p-5" aria-labelledby="kyc-holder">
          <Heading level={2} size="card" id="kyc-holder">
            {t('holder')}
          </Heading>
          <DescriptionList
            items={[
              {
                key: 'name',
                term: t('name'),
                description: submission.holder ? (
                  <Link
                    href={routes.adminMember(submission.userId)}
                    className="link-underline-hover text-accent"
                  >
                    {submission.holder.displayName}
                  </Link>
                ) : (
                  common('deletedMember')
                ),
              },
              {
                key: 'submitted',
                term: t('columns.submitted'),
                description: format.dateTime(new Date(submission.submittedAt), {
                  dateStyle: 'long',
                  timeStyle: 'short',
                }),
              },
              {
                key: 'status',
                term: t('columns.status'),
                description: (
                  <Badge
                    tone={
                      submission.status === 'approved'
                        ? 'success'
                        : submission.status === 'rejected'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {reference(`kycReviewStatuses.${submission.status}`)}
                  </Badge>
                ),
              },
            ]}
          />
        </Card>
        {submission.decisionReason ? (
          <Card className="grid gap-2 p-5" aria-labelledby="kyc-decided">
            <Heading level={2} size="card" id="kyc-decided">
              {t('decided')}
            </Heading>
            <p className="text-sm whitespace-pre-line">{submission.decisionReason}</p>
            {submission.decidedAt ? (
              <Text size="sm" tone="muted">
                {format.dateTime(new Date(submission.decidedAt), {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
              </Text>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}

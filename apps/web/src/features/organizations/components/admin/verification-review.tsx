'use client';

import { verificationControllerDecide, verificationControllerRevoke } from '@pitchorium/api-client';
import type { VerificationRequest } from '@pitchorium/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  Checkbox,
  DescriptionList,
  Field,
  Heading,
  RadioGroup,
  Text,
  Textarea,
  useAnnounce,
} from '@/components/ui';
import * as routes from '@/config/paths';
import { PrivateDocuments, useConsoleAction, useConsoleProblem } from '@/features/admin';
import { Link, useRouter } from '@/i18n/navigation';

/** Shortest motivation of a decision or a revocation (REASON_MIN_LENGTH of the contracts). */
const REASON_MIN = 10;
const REASON_MAX = 2_000;

/**
 * The review of a verification request (§13): the declaration, the private documents opened by
 * a signed address, the non-decisive signal of the domain, the configured criteria to tick, and
 * a motivated decision shared with the owners; a verified organisation is revoked with a reason
 * and a typed confirmation.
 */
export function VerificationReview({
  request,
  criteria,
}: {
  request: VerificationRequest;
  /** Configured criteria (ORGANIZATIONS_VERIFICATION_CRITERIA), none by default. */
  criteria: readonly string[];
}) {
  const t = useTranslations('web.admin.verification');
  const common = useTranslations('web.admin.common');
  const format = useFormatter();
  const problem = useConsoleProblem();
  const announce = useAnnounce();
  const router = useRouter();
  const review = useConsoleAction('organization.verification.review');
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [reason, setReason] = useState('');
  const [ticked, setTicked] = useState<string[]>([]);
  const [revocation, setRevocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = reason.trim().length >= REASON_MIN;
  const verified = request.organization.verificationStatus === 'verified';
  async function decide() {
    setBusy(true);
    setError(null);
    try {
      await verificationControllerDecide(request.id, {
        decision,
        reason: reason.trim(),
        criteriaMet: ticked,
      });
      announce(t(decision === 'approved' ? 'approvedDone' : 'rejectedDone'));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    setError(null);
    try {
      await verificationControllerRevoke(request.organization.id, { reason: revocation.trim() });
      announce(t('revokedDone'));
      router.refresh();
    } catch (failure) {
      setError(problem(failure));
    }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid content-start gap-6">
        <Card className="grid gap-3 p-5" aria-labelledby="declaration-title">
          <Heading level={2} size="card" id="declaration-title">
            {t('declaration')}
          </Heading>
          <p className="text-sm whitespace-pre-line">{request.declaration}</p>
          <Text size="sm" tone="muted">
            {t('requestedBy', {
              name: request.requester?.name ?? common('deletedMember'),
              date: format.dateTime(new Date(request.createdAt), { dateStyle: 'long' }),
            })}
          </Text>
        </Card>
        <Card className="grid gap-3 p-5" aria-labelledby="documents-title">
          <Heading level={2} size="card" id="documents-title">
            {t('documents')}
          </Heading>
          <PrivateDocuments mediaIds={request.documentMediaIds} />
        </Card>
        {request.status === 'pending' && review.visible ? (
          <Card className="grid gap-4 p-5" aria-labelledby="decide-title">
            <Heading level={2} size="card" id="decide-title">
              {t('decide')}
            </Heading>
            <Field
              label={t('criteria')}
              description={criteria.length === 0 ? t('noCriteria') : t('criteriaHint')}
            >
              <div className="grid gap-2">
                {criteria.map((criterion) => (
                  <Checkbox
                    key={criterion}
                    label={criterion}
                    checked={ticked.includes(criterion)}
                    onCheckedChange={(checked) =>
                      setTicked((current) =>
                        checked === true
                          ? [...current, criterion]
                          : current.filter((item) => item !== criterion),
                      )
                    }
                  />
                ))}
              </div>
            </Field>
            <Field label={t('decision')}>
              <RadioGroup
                variant="card"
                value={decision}
                onValueChange={setDecision}
                options={[
                  { value: 'approved', label: t('approve'), description: t('approveHint') },
                  { value: 'rejected', label: t('reject'), description: t('rejectHint') },
                ]}
              />
            </Field>
            <Field
              label={t('reason')}
              description={t('reasonHint')}
              counter={{ count: reason.length, max: REASON_MAX }}
            >
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minRows={3}
                maxLength={REASON_MAX}
              />
            </Field>
            <div className="flex justify-end">
              <Button
                loading={busy}
                loadingLabel={t('deciding')}
                disabledReason={
                  review.disabledReason ??
                  (valid ? undefined : t('reasonLength', { min: REASON_MIN }))
                }
                onClick={() => void decide()}
              >
                {decision === 'approved' ? t('approve') : t('reject')}
              </Button>
            </div>
          </Card>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <div className="grid content-start gap-6">
        <Card className="grid gap-3 p-5" aria-labelledby="organization-title">
          <Heading level={2} size="card" id="organization-title">
            {t('organization')}
          </Heading>
          <DescriptionList
            items={[
              {
                key: 'name',
                term: t('name'),
                description: (
                  <Link
                    href={routes.organization(request.organization.slug)}
                    className="link-underline-hover text-accent"
                  >
                    {request.organization.name}
                  </Link>
                ),
              },
              {
                key: 'website',
                term: t('website'),
                description: request.organization.websiteUrl ?? t('noWebsite'),
              },
              {
                key: 'signal',
                term: t('signal'),
                description: request.signals.memberEmailOnWebsiteDomain
                  ? t('signalYes')
                  : t('signalNo'),
              },
              {
                key: 'state',
                term: t('state'),
                description: (
                  <Badge tone={verified ? 'success' : 'neutral'}>
                    {t(`organizationStatus.${request.organization.verificationStatus}`)}
                  </Badge>
                ),
              },
            ]}
          />
          <Text size="sm" tone="muted">
            {t('signalHint')}
          </Text>
        </Card>
        {request.status !== 'pending' ? (
          <Card className="grid gap-2 p-5" aria-labelledby="decided-title">
            <Heading level={2} size="card" id="decided-title">
              {t(`status.${request.status}`)}
            </Heading>
            {request.decisionReason ? (
              <p className="text-sm whitespace-pre-line">{request.decisionReason}</p>
            ) : null}
            {request.criteriaMet.length > 0 ? (
              <Text size="sm" tone="muted">
                {t('criteriaMet', { list: request.criteriaMet.join(', ') })}
              </Text>
            ) : null}
          </Card>
        ) : null}
        {verified && review.visible ? (
          <Card className="grid gap-3 p-5" aria-labelledby="revoke-title">
            <Heading level={2} size="card" id="revoke-title">
              {t('revoke')}
            </Heading>
            <Text size="sm">{t('revokeHint')}</Text>
            <Field
              label={t('revokeReason')}
              counter={{ count: revocation.length, max: REASON_MAX }}
            >
              <Textarea
                value={revocation}
                onChange={(event) => setRevocation(event.target.value)}
                minRows={3}
                maxLength={REASON_MAX}
              />
            </Field>
            <AlertDialog
              trigger={
                <Button
                  variant="danger"
                  className="justify-self-start"
                  disabledReason={
                    review.disabledReason ??
                    (revocation.trim().length >= REASON_MIN
                      ? undefined
                      : t('reasonLength', { min: REASON_MIN }))
                  }
                >
                  {t('revoke')}
                </Button>
              }
              title={t('revokeTitle', { name: request.organization.name })}
              description={t('revokeDescription')}
              confirmLabel={t('revoke')}
              confirmPhrase={request.organization.name}
              onConfirm={revoke}
            />
          </Card>
        ) : null}
      </div>
    </div>
  );
}

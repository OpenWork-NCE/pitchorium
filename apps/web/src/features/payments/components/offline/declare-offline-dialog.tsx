'use client';

import {
  offlineContributionsControllerDeclare,
  offlineContributionsControllerDeclareForMember,
  offlineContributionsControllerProofs,
} from '@pitchorium/api-client';
import type {
  DeclareTeamOfflineContributionRequest,
  OfflineContribution,
  OfflineContributionKind,
} from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  FileDrop,
  Form,
  FormActions,
  FormField,
  Input,
  MoneyInput,
  RadioGroup,
  Select,
  Textarea,
  useAnnounce,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { useWithPrerequisites } from '@/features/access';
import { OFFLINE_CURRENCIES, PAYMENT_LIMITS } from '../../lib/limits';
import { PRIVATE_DOCUMENT_TYPES, usePrivateUploads } from '../shared/use-private-uploads';

const KINDS: readonly OfflineContributionKind[] = [
  'cash',
  'institutional_transfer',
  'skills_sponsorship',
  'love_money_commitment',
];
const MONETARY = new Set<OfflineContributionKind>(['cash', 'institutional_transfer']);

type Values = DeclareTeamOfflineContributionRequest;

const contributorSchema = () =>
  import('@pitchorium/contracts').then((module) => module.declareOfflineContributionRequestSchema);
const teamSchema = () =>
  import('@pitchorium/contracts').then(
    (module) => module.declareTeamOfflineContributionRequestSchema,
  );

/**
 * Declaration of an off-platform contribution (§9.3, fallback; ADR 0049): cash, an institutional
 * transfer, a skills sponsorship or a love money commitment, by the contributor, or by the team
 * of the project for a contributor named by their handle (`team`). The other party confirms or
 * refuses; private proofs go with it. An amount counts in the collected amount only once an
 * administrator validated it on proof.
 */
export default function DeclareOfflineDialog({
  projectId,
  projectTitle,
  open,
  onOpenChange,
  team = false,
  onDeclared,
}: {
  projectId: string;
  projectTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Declared by the team of the project for a contributor. */
  team?: boolean;
  onDeclared?: (declared: OfflineContribution) => void;
}) {
  const t = useTranslations('web.payments.offline.declare');
  const kinds = useTranslations('reference.offlineContributionKinds');
  const announce = useAnnounce();
  const withPrerequisites = useWithPrerequisites();
  const files = usePrivateUploads(PAYMENT_LIMITS.offlineProofs);
  const form = useZodForm(team ? teamSchema : (contributorSchema as typeof teamSchema), {
    defaultValues: { kind: 'cash', contributorHandle: '' } as Partial<Values>,
  });
  const applyProblem = useApplyProblem(form);
  const [currency, setCurrency] = useState<(typeof OFFLINE_CURRENCIES)[number]>('EUR');
  const key = useRef(crypto.randomUUID());
  const kind = useWatch({ control: form.control, name: 'kind' });
  const monetary = MONETARY.has(kind);

  async function submit(values: Values) {
    const body = {
      kind: values.kind,
      ...(monetary && values.amount ? { amount: values.amount } : {}),
      ...(values.description ? { description: values.description } : {}),
    };
    let declared: OfflineContribution;
    try {
      declared = await withPrerequisites<OfflineContribution>(() =>
        team
          ? offlineContributionsControllerDeclareForMember(
              projectId,
              { ...body, contributorHandle: values.contributorHandle },
              { headers: { 'Idempotency-Key': key.current } },
            )
          : offlineContributionsControllerDeclare(projectId, body, {
              headers: { 'Idempotency-Key': key.current },
            }),
      );
    } catch (error) {
      applyProblem(error);
      return;
    }
    if (files.ready.length > 0) {
      try {
        declared = await offlineContributionsControllerProofs(declared.id, {
          mediaIds: files.ready,
        });
      } catch (error) {
        applyProblem(error);
        return;
      }
    }
    announce(t('declared'));
    key.current = crypto.randomUUID();
    form.reset();
    files.reset();
    onDeclared?.(declared);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t(team ? 'teamTitle' : 'title')}
        description={t(team ? 'teamDescription' : 'description', { title: projectTitle })}
        size="lg"
      >
        <Form form={form} onSubmit={submit} aria-label={t(team ? 'teamTitle' : 'title')}>
          {team ? (
            <FormField
              control={form.control}
              name="contributorHandle"
              label={t('contributor')}
              description={t('contributorHint')}
              render={({ field }) => <Input {...field} autoComplete="off" spellCheck={false} />}
            />
          ) : null}
          <FormField
            control={form.control}
            name="kind"
            label={t('kind')}
            render={({ field }) => (
              <RadioGroup
                variant="card"
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  if (!MONETARY.has(value)) form.setValue('amount', undefined);
                }}
                options={KINDS.map((value) => ({
                  value,
                  label: kinds(value),
                  description: t(`kinds.${value}`),
                }))}
              />
            )}
          />
          {monetary ? (
            <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <div className="grid gap-1.5">
                <span className="text-sm font-medium" id="offline-currency">
                  {t('currency')}
                </span>
                <Select
                  aria-labelledby="offline-currency"
                  value={currency}
                  onValueChange={(value) => {
                    setCurrency(value);
                    form.setValue('amount', undefined);
                  }}
                  options={OFFLINE_CURRENCIES.map((value) => ({ value, label: value }))}
                />
              </div>
              <FormField
                control={form.control}
                name="amount"
                label={t('amount')}
                render={({ field }) => (
                  <MoneyInput
                    currency={currency}
                    value={field.value?.amountMinor ?? null}
                    onChange={(minor) =>
                      field.onChange(minor ? { amountMinor: minor, currency } : undefined)
                    }
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>
          ) : null}
          <FormField
            control={form.control}
            name="description"
            label={t('descriptionLabel')}
            optional
            maxLength={PAYMENT_LIMITS.offlineDescription}
            render={({ field }) => (
              <Textarea
                {...field}
                value={field.value ?? ''}
                onChange={(event) => field.onChange(event.target.value || undefined)}
                rows={3}
              />
            )}
          />
          <FileDrop
            label={t('proofs')}
            limits={t('proofsLimits', { max: PAYMENT_LIMITS.offlineProofs })}
            accept={PRIVATE_DOCUMENT_TYPES}
            multiple
            disabled={files.full}
            items={files.items}
            onFiles={files.add}
            onRemove={files.remove}
            onRetry={files.retry}
          />
          <Alert tone="info">{t(monetary ? 'countsAfterValidation' : 'notCounted')}</Alert>
          <FormActions>
            <Button
              type="submit"
              loading={form.formState.isSubmitting}
              loadingLabel={t('declaring')}
              disabledReason={files.uploading ? t('waitUploads') : undefined}
            >
              {t('submit')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
          </FormActions>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

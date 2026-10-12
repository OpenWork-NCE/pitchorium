'use client';

import { reportsControllerReasons, reportsControllerReport } from '@pitchorium/api-client';
import type { ReportReasonList, ReportReason } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  ErrorState,
  Form,
  FormActions,
  FormField,
  RadioGroup,
  Skeleton,
  Textarea,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { useWithPrerequisites } from '@/features/access';
import type { ReportTarget } from '@/lib/actions/report';
import { TRUST_LIMITS } from '../lib/limits';

const schema = () =>
  import('@pitchorium/contracts').then((module) =>
    module.createReportRequestSchema.pick({ reason: true, details: true }),
  );

interface Values {
  reason: ReportReason;
  details?: string | null;
}

/**
 * « Signaler » (§13): the reasons the api lists, details, then the receipt. A message is reported
 * with the few messages before it only, which the dialog says. Loaded at its first opening by the
 * member shell (ReportHost).
 */
export default function ReportDialog({
  target,
  open,
  onOpenChange,
}: {
  target: ReportTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('web.trust.report');
  const reference = useTranslations('reference');
  const withPrerequisites = useWithPrerequisites();
  const [reasons, setReasons] = useState<ReportReasonList['items'] | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [received, setReceived] = useState(false);
  const form = useZodForm(schema, { defaultValues: {} as Partial<Values> });
  const applyProblem = useApplyProblem(form);

  const read = useCallback(
    () =>
      reportsControllerReasons().then(
        (list) => setReasons(list.items),
        () => setUnreadable(true),
      ),
    [],
  );
  useEffect(() => void read(), [read]);
  const retry = () => {
    setUnreadable(false);
    void read();
  };

  async function submit(values: Values) {
    try {
      await withPrerequisites(() =>
        reportsControllerReport({
          targetType: target.type,
          targetId: target.id,
          reason: values.reason,
          details: values.details?.trim() ? values.details.trim() : null,
        }),
      );
    } catch (error) {
      applyProblem(error);
      return;
    }
    setReceived(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={received ? t('receivedTitle') : t(`titles.${target.type}`)}
        description={received ? undefined : t('description')}
      >
        {received ? (
          <div className="grid gap-4">
            <Alert tone="success">{t('received')}</Alert>
            <FormActions>
              <Button type="button" onClick={() => onOpenChange(false)}>
                {t('close')}
              </Button>
            </FormActions>
          </div>
        ) : unreadable ? (
          <ErrorState size="inline" title={t('unreadable')} onRetry={retry} />
        ) : !reasons ? (
          <div className="grid gap-2" aria-busy="true" aria-label={t('loading')}>
            {[0, 1, 2, 3].map((line) => (
              <Skeleton key={line} className="h-11 w-full rounded-md" />
            ))}
          </div>
        ) : (
          <Form form={form} onSubmit={submit} aria-label={t(`titles.${target.type}`)}>
            {target.type === 'message' ? <Alert tone="info">{t('messageScope')}</Alert> : null}
            <FormField
              control={form.control}
              name="reason"
              label={t('reason')}
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  options={reasons.map((reason) => ({
                    value: reason.code,
                    label: reference.has(reason.labelKey as never)
                      ? reference(reason.labelKey as never)
                      : reason.code,
                  }))}
                />
              )}
            />
            <FormField
              control={form.control}
              name="details"
              label={t('details')}
              description={t('detailsHint')}
              optional
              maxLength={TRUST_LIMITS.reportDetails}
              render={({ field }) => <Textarea {...field} value={field.value ?? ''} rows={4} />}
            />
            <FormActions>
              <Button
                type="submit"
                loading={form.formState.isSubmitting}
                loadingLabel={t('sending')}
              >
                {t('submit')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
            </FormActions>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

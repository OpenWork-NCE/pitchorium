'use client';

import { interestsControllerExpress } from '@pitchorium/api-client';
import type { ExpressInterestRequest } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  FileDrop,
  Form,
  FormActions,
  FormField,
  MoneyInput,
  RadioGroup,
  Textarea,
  useAnnounce,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { useWithPrerequisites } from '@/features/access';
import { PROJECT_LIMITS } from '../../lib/limits';
import { useFileUploads } from '../shared/use-file-uploads';

const KINDS = ['grant', 'honor_loan', 'equity', 'general'] as const;

const schema = () =>
  import('@pitchorium/contracts').then((module) =>
    module.expressInterestRequestSchema.omit({ documentMediaIds: true }),
  );

type Values = Omit<ExpressInterestRequest, 'documentMediaIds'>;

/**
 * « Manifester un intérêt » (§9.1, §11.2): a grant, a honour loan, a stake (an intention only,
 * §15 decision 5) or a general contact, with a message, an indicative amount that binds no one
 * and private PDF files read by the team only. No payment: the team answers outside the page.
 * Loaded at the first opening.
 */
export default function InterestDialog({
  projectId,
  projectTitle,
  open,
  onOpenChange,
}: {
  projectId: string;
  projectTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('web.projects.interest');
  const kinds = useTranslations('reference.projectInterestKinds');
  const announce = useAnnounce();
  const withPrerequisites = useWithPrerequisites();
  const files = useFileUploads('project_interest_document', PROJECT_LIMITS.interestDocuments);
  const form = useZodForm(schema, {
    defaultValues: { kind: 'general', message: '' } as Partial<Values>,
  });
  const applyProblem = useApplyProblem(form);

  async function submit(values: Values) {
    try {
      await withPrerequisites(() =>
        interestsControllerExpress(projectId, {
          kind: values.kind,
          message: values.message,
          ...(values.indicativeAmount ? { indicativeAmount: values.indicativeAmount } : {}),
          ...(files.ready.length > 0 ? { documentMediaIds: files.ready } : {}),
        }),
      );
    } catch (error) {
      applyProblem(error);
      return;
    }
    announce(t('sent'));
    form.reset();
    files.reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={t('title')} description={t('description', { title: projectTitle })}>
        <Form form={form} onSubmit={submit} aria-label={t('title')}>
          <FormField
            control={form.control}
            name="kind"
            label={t('kind')}
            render={({ field }) => (
              <RadioGroup
                variant="card"
                value={field.value}
                onValueChange={field.onChange}
                options={KINDS.map((kind) => ({
                  value: kind,
                  label: kinds(kind),
                  description: t(`kinds.${kind}`),
                }))}
              />
            )}
          />
          <FormField
            control={form.control}
            name="message"
            label={t('message')}
            maxLength={PROJECT_LIMITS.interestMessage}
            render={({ field }) => <Textarea {...field} rows={5} />}
          />
          <FormField
            control={form.control}
            name="indicativeAmount"
            label={t('amount')}
            description={t('amountHint')}
            optional
            render={({ field }) => (
              <MoneyInput
                currency="EUR"
                value={field.value?.amountMinor ?? null}
                onChange={(minor) =>
                  field.onChange(minor ? { amountMinor: minor, currency: 'EUR' } : undefined)
                }
                onBlur={field.onBlur}
              />
            )}
          />
          <FileDrop
            label={t('documents')}
            limits={t('documentsLimits', { max: PROJECT_LIMITS.interestDocuments })}
            accept={['application/pdf']}
            multiple
            disabled={files.full}
            items={files.items}
            onFiles={files.add}
            onRemove={files.remove}
            onRetry={files.retry}
          />
          <Alert tone="info">{t('noPayment')}</Alert>
          <FormActions>
            <Button
              type="submit"
              loading={form.formState.isSubmitting}
              loadingLabel={t('sending')}
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

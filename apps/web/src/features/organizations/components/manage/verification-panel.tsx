'use client';

import {
  getVerificationControllerHistoryQueryKey,
  useVerificationControllerHistory,
  verificationControllerRequest,
} from '@pitchorium/api-client';
import {
  DECLARATION_MIN_LENGTH,
  type Organization,
  type OwnVerificationRequest,
} from '@pitchorium/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  FileDrop,
  type FileDropItem,
  Form,
  FormActions,
  FormField,
  Heading,
  Skeleton,
  Text,
  Textarea,
  VerifiedBadge,
  useAnnounce,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { MediaRejectedError, uploadMedia } from '@/features/media';
import { useRouter } from '@/i18n/navigation';
import { createVerificationRequest } from '../../lib/schemas';
import { usePlural } from '@/lib/i18n/plural';

const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
const MAX_DOCUMENTS = 10;
/** A new request is possible from these states (domain/verification.ts of the module). */
const REQUESTABLE = new Set(['unverified', 'rejected', 'revoked']);

type Document = FileDropItem & { mediaId?: string; file: File };

/**
 * The verification of the organisation (§13): its state and badge, the requests made and the
 * motivation of a decision, then, for an owner when the state allows it, a new request: private
 * supporting documents, a declaration, a certification. The badge is granted by Pitchorium only.
 */
export function VerificationPanel({ organization }: { organization: Organization }) {
  const t = useTranslations('web.organizations.manage.verification');
  const statuses = useTranslations('reference.verificationStatuses');
  const format = useFormatter();
  const history = useVerificationControllerHistory(organization.id);
  const { status, verified, verifiedAt } = organization.verification;
  const canRequest = organization.viewerRole === 'owner' && REQUESTABLE.has(status);
  return (
    <div className="grid gap-6">
      <Card className="grid gap-3" aria-labelledby="verification-title">
        <div className="flex flex-wrap items-center gap-2">
          <Heading level={2} size="card" id="verification-title">
            {t('title')}
          </Heading>
          {verified ? <VerifiedBadge display="label" /> : <Badge>{statuses(status)}</Badge>}
        </div>
        <Text size="sm" tone="muted">
          {verified && verifiedAt
            ? t('verifiedOn', {
                date: format.dateTime(new Date(verifiedAt), { dateStyle: 'long' }),
              })
            : t(`status.${status}`)}
        </Text>
      </Card>
      {canRequest ? <RequestForm organization={organization} /> : null}
      <Card className="grid gap-3" aria-labelledby="history-title">
        <Heading level={2} size="card" id="history-title">
          {t('history')}
        </Heading>
        {history.isPending ? (
          <Skeleton className="h-16" />
        ) : (history.data?.items.length ?? 0) === 0 ? (
          <Text size="sm" tone="muted">
            {t('noRequest')}
          </Text>
        ) : (
          <ol className="grid gap-3">
            {history.data?.items.map((request) => (
              <RequestItem key={request.id} request={request} />
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

function RequestItem({ request }: { request: OwnVerificationRequest }) {
  const t = useTranslations('web.organizations.manage.verification');
  const format = useFormatter();
  const plural = usePlural();
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: 'medium' });
  return (
    <li
      className="grid gap-1 rounded-md border border-border p-3"
      data-verification={request.status}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{t(`requestStatus.${request.status}`)}</span>
        <span className="text-xs text-muted">
          {t('requestedOn', { date: date(request.createdAt) })}
        </span>
      </div>
      <span className="text-sm text-muted">
        {t(`documents.${plural(request.documentCount)}`, { count: request.documentCount })}
      </span>
      {request.decisionReason ? (
        <div className="grid gap-0.5 border-t border-border pt-2 text-sm">
          <span className="font-medium">
            {t('reason', { date: request.decidedAt ? date(request.decidedAt) : '' })}
          </span>
          <p className="whitespace-pre-line">{request.decisionReason}</p>
        </div>
      ) : null}
    </li>
  );
}

function RequestForm({ organization }: { organization: Organization }) {
  const t = useTranslations('web.organizations.manage.verification');
  const rejections = useTranslations('reference.mediaRejectionReasons');
  const announce = useAnnounce();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [documents, setDocuments] = useState<Document[]>([]);
  const form = useZodForm(createVerificationRequest, {
    defaultValues: { declaration: '', certified: false as never, documentMediaIds: [] },
  });
  const applyProblem = useApplyProblem(form);
  const ready = documents.flatMap((document) => (document.mediaId ? [document.mediaId] : []));
  const uploading = documents.some(
    (document) => document.state === 'uploading' || document.state === 'processing',
  );

  const update = (id: string, patch: Partial<Document>) =>
    setDocuments((current) =>
      current.map((document) => (document.id === id ? { ...document, ...patch } : document)),
    );

  async function send(document: Document) {
    try {
      const mediaId = await uploadMedia(document.file, 'verification_document', (step) =>
        update(
          document.id,
          step.step === 'sending'
            ? { state: 'uploading', progress: step.progress }
            : { state: 'processing', progress: undefined },
        ),
      );
      update(document.id, { state: 'ready', mediaId });
    } catch (error) {
      const reason = error instanceof MediaRejectedError ? error.reason : null;
      update(document.id, {
        state: 'rejected',
        reason:
          reason && rejections.has(reason as never)
            ? rejections(reason as never)
            : t('uploadFailed'),
      });
    }
  }

  function add(files: File[]) {
    const room = MAX_DOCUMENTS - documents.length;
    const added = files.slice(0, Math.max(0, room)).map((file): Document => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      state: 'pending',
      file,
    }));
    setDocuments((current) => [...current, ...added]);
    for (const document of added) void send(document);
  }

  async function submit(values: { declaration: string; certified: true }) {
    try {
      await verificationControllerRequest(organization.id, {
        declaration: values.declaration,
        certified: values.certified,
        documentMediaIds: ready,
      });
    } catch (error) {
      applyProblem(error);
      return;
    }
    announce(t('requested'));
    await queryClient.invalidateQueries({
      queryKey: getVerificationControllerHistoryQueryKey(organization.id),
    });
    router.refresh();
  }

  return (
    <Card className="grid gap-4" aria-labelledby="request-title">
      <div className="grid gap-1">
        <Heading level={2} size="card" id="request-title">
          {t('requestTitle')}
        </Heading>
        <Text size="sm" tone="muted">
          {t('requestDescription')}
        </Text>
      </div>
      <Form form={form} onSubmit={submit} aria-label={t('requestTitle')}>
        <FileDrop
          label={t('documentsLabel')}
          limits={t('documentsLimits')}
          accept={DOCUMENT_TYPES}
          multiple
          disabled={documents.length >= MAX_DOCUMENTS}
          items={documents}
          onFiles={add}
          onRemove={(id) => setDocuments((current) => current.filter((item) => item.id !== id))}
          onRetry={(id) => {
            const document = documents.find((item) => item.id === id);
            if (document) void send(document);
          }}
        />
        <FormField
          control={form.control}
          name="declaration"
          label={t('declaration')}
          description={t('declarationHint', { min: DECLARATION_MIN_LENGTH })}
          maxLength={2600}
          render={({ field }) => <Textarea {...field} rows={5} />}
        />
        <FormField
          control={form.control}
          name="certified"
          label={t('certified')}
          hideLabel
          render={({ field }) => (
            <Checkbox
              label={t('certified')}
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              onBlur={field.onBlur}
            />
          )}
        />
        {ready.length === 0 ? <Alert tone="info">{t('documentsRequired')}</Alert> : null}
        <FormActions>
          <Button
            type="submit"
            loading={form.formState.isSubmitting}
            loadingLabel={t('sending')}
            disabledReason={
              uploading ? t('waitUploads') : ready.length === 0 ? t('documentsRequired') : undefined
            }
          >
            {t('submit')}
          </Button>
        </FormActions>
      </Form>
    </Card>
  );
}

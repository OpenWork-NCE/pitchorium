'use client';

import {
  ApiProblemError,
  eventsControllerForPublic,
  organizationsControllerForPublic,
  projectsControllerForPublic,
  reportsControllerNotice,
} from '@pitchorium/api-client';
import type { ReportReceipt } from '@pitchorium/contracts';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useWatch } from 'react-hook-form';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormActions,
  FormField,
  Input,
  Text,
  Textarea,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { type TurnstileSettings, useTurnstile } from '@/features/identity';
import { configureBrowserApi } from '@/lib/api/browser';
import { TRUST_LIMITS } from '../lib/limits';
import { type NoticeTarget, noticeTargetOf } from '../lib/report-address';

configureBrowserApi();

const schema = () =>
  import('@pitchorium/contracts').then((contracts) =>
    contracts.anonymousReportRequestSchema
      .pick({ details: true, reporterName: true, reporterEmail: true, goodFaith: true })
      // The full address of the page, as the browser shows it (`https://…`).
      .extend({ address: contracts.postLinkUrlSchema }),
  );

interface Values {
  address: string;
  details: string;
  reporterName?: string | null;
  reporterEmail?: string | null;
  goodFaith: true;
}

/** The identifier the api expects: a profile by its handle, the others by their id. */
async function targetIdOf(target: NoticeTarget): Promise<string> {
  switch (target.type) {
    case 'organization':
      return (await organizationsControllerForPublic(target.key)).id;
    case 'project':
      return (await projectsControllerForPublic(target.key)).id;
    case 'event':
      return (await eventsControllerForPublic(target.key)).id;
    case 'profile':
    case 'post':
    case 'mission':
      return target.key;
  }
}

/**
 * Notice of illegal content without an account (§13, DSA notice and action): the address of the
 * public page, the explanation, an optional contact (without it, no information on the decision)
 * and the declaration of good faith, checked by Turnstile when the api requires it (ADR 0103).
 * Then the receipt and its reference.
 */
export function NoticeForm({ turnstile: settings }: { turnstile: TurnstileSettings | null }) {
  const t = useTranslations('web.trust.notice');
  const errors = useTranslations('errors');
  const reference = useTranslations('reference.reportTargetTypes');
  const locale = useLocale();
  const format = useFormatter();
  const turnstile = useTurnstile(settings, 'report');
  const form = useZodForm(schema, {
    defaultValues: { address: '', details: '' } as Partial<Values>,
  });
  const applyProblem = useApplyProblem(form);
  const [receipt, setReceipt] = useState<{ receipt: ReportReceipt; email: boolean } | null>(null);

  async function submit(values: Values) {
    const target = noticeTargetOf(values.address, window.location.origin);
    if (!target) {
      form.setError('address', { message: t('addressInvalid') });
      return;
    }
    let targetId: string;
    try {
      targetId = await targetIdOf(target);
    } catch (error) {
      if (error instanceof ApiProblemError && error.problem.status === 404) {
        form.setError('address', { message: t('addressNotFound') });
      } else applyProblem(error);
      return;
    }
    const passed = await turnstile.challenge();
    if (!passed) {
      form.setError('root.server', { message: errors('CAPTCHA_REQUIRED') });
      return;
    }
    try {
      const email = values.reporterEmail?.trim() || null;
      const answer = await reportsControllerNotice(
        {
          targetType: target.type,
          targetId,
          details: values.details,
          reporterName: values.reporterName?.trim() || null,
          reporterEmail: email,
          locale,
          goodFaith: true,
        },
        passed.token ? { headers: { 'X-Captcha-Response': passed.token } } : undefined,
      );
      setReceipt({ receipt: answer, email: email !== null });
    } catch (error) {
      applyProblem(error);
    } finally {
      turnstile.reset();
    }
  }

  // Empty at the first render, on the server as in the browser: no mismatch.
  const address = useWatch({ control: form.control, name: 'address' });
  const target =
    address && typeof window !== 'undefined'
      ? noticeTargetOf(address, window.location.origin)
      : null;
  if (receipt) {
    return (
      <div className="grid gap-4">
        <Alert tone="success" title={t('receivedTitle')}>
          <span className="grid gap-1">
            <span>
              {t('received', {
                date: format.dateTime(new Date(receipt.receipt.receivedAt), { dateStyle: 'long' }),
                reference: receipt.receipt.id,
              })}
            </span>
            <span>{receipt.email ? t('receivedEmail') : t('receivedNoEmail')}</span>
          </span>
        </Alert>
        <Button
          type="button"
          variant="secondary"
          className="justify-self-start"
          onClick={() => {
            form.reset();
            setReceipt(null);
          }}
        >
          {t('another')}
        </Button>
      </div>
    );
  }

  return (
    <Form form={form} onSubmit={submit} aria-label={t('title')}>
      <FormField
        control={form.control}
        name="address"
        label={t('address')}
        description={t('addressHint')}
        render={({ field }) => (
          <Input {...field} type="url" inputMode="url" autoComplete="off" spellCheck={false} />
        )}
      />
      {target ? (
        <Text size="sm" tone="muted" aria-live="polite">
          {t('target', { target: reference(target.type) })}
        </Text>
      ) : null}
      <FormField
        control={form.control}
        name="details"
        label={t('details')}
        description={t('detailsHint')}
        maxLength={TRUST_LIMITS.reportDetails}
        render={({ field }) => <Textarea {...field} rows={6} />}
      />
      <FormField
        control={form.control}
        name="reporterName"
        label={t('name')}
        optional
        render={({ field }) => (
          <Input
            {...field}
            value={field.value ?? ''}
            // Left empty, the name is absent rather than an empty text.
            onChange={(event) => field.onChange(event.target.value || undefined)}
            autoComplete="name"
          />
        )}
      />
      <FormField
        control={form.control}
        name="reporterEmail"
        label={t('email')}
        description={t('emailHint')}
        optional
        render={({ field }) => (
          <Input
            {...field}
            value={field.value ?? ''}
            onChange={(event) => field.onChange(event.target.value || undefined)}
            type="email"
            autoComplete="email"
          />
        )}
      />
      <FormField
        control={form.control}
        name="goodFaith"
        label={t('goodFaith')}
        hideLabel
        render={({ field }) => (
          <Checkbox
            checked={field.value === true}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            onBlur={field.onBlur}
            label={t('goodFaith')}
          />
        )}
      />
      {turnstile.widget}
      <FormActions>
        <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={t('sending')}>
          {t('submit')}
        </Button>
      </FormActions>
    </Form>
  );
}

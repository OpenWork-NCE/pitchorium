'use client';

import { accountControllerAccept, type LegalVersionsDtoOutput } from '@pitchorium/api-client';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { z } from 'zod';
import {
  Button,
  Checkbox,
  Form,
  FormActions,
  FormField,
  useApplyProblem,
  useZodForm,
} from '@/components/ui';
import { publicEnv } from '@/lib/public-env';

/** Three boxes to tick, each a declaration of the member; the api receives the versions. */
const legalFormSchema = z.object({
  terms: z.literal(true),
  privacy: z.literal(true),
  adult: z.literal(true),
});

function TextLink({ href, children }: { href: string | undefined; children: ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="link-underline-hover text-accent underline"
    >
      {children}
    </a>
  );
}

/**
 * Terms of use, privacy policy in the versions in force and the declaration of age (§7.2,
 * identity): required for every sign-in method, before anything else. Used by the onboarding and
 * by the prerequisite dialog (`legal_acceptance`).
 */
export function LegalAcceptanceForm({
  versions,
  submitLabel,
  onAccepted,
}: {
  versions: LegalVersionsDtoOutput;
  submitLabel?: string;
  onAccepted: () => void | Promise<void>;
}) {
  const t = useTranslations('web.onboarding.terms');
  const form = useZodForm(legalFormSchema, {
    defaultValues: { terms: false, privacy: false, adult: false } as never,
  });
  const applyProblem = useApplyProblem(form);

  async function submit() {
    try {
      await accountControllerAccept({
        termsVersion: versions.termsVersion,
        privacyVersion: versions.privacyVersion,
        adultDeclaration: true,
      });
      await onAccepted();
    } catch (error) {
      if (!applyProblem(error)) form.setError('root.server', { message: t('failed') });
    }
  }

  // The short name labels the field in the summary of errors; the sentence is the visible label.
  const box = (name: 'terms' | 'privacy' | 'adult', sentence: ReactNode) => (
    <FormField
      control={form.control}
      name={name}
      label={t(`names.${name}`)}
      hideLabel
      render={({ field }) => (
        <Checkbox
          checked={field.value === true}
          onCheckedChange={(checked) => field.onChange(checked === true)}
          onBlur={field.onBlur}
          label={sentence}
        />
      )}
    />
  );

  return (
    <Form form={form} onSubmit={submit} aria-label={t('formLabel')}>
      {box(
        'terms',
        t.rich('acceptTerms', {
          version: versions.termsVersion,
          link: (chunks) => <TextLink href={publicEnv.legalTermsUrl}>{chunks}</TextLink>,
        }),
      )}
      {box(
        'privacy',
        t.rich('acceptPrivacy', {
          version: versions.privacyVersion,
          link: (chunks) => <TextLink href={publicEnv.legalPrivacyUrl}>{chunks}</TextLink>,
        }),
      )}
      {box('adult', t('declareAge', { age: versions.minimumAge }))}
      <FormActions>
        <Button
          type="submit"
          className="w-full sm:w-auto"
          loading={form.formState.isSubmitting}
          loadingLabel={t('saving')}
        >
          {submitLabel ?? t('submit')}
        </Button>
      </FormActions>
    </Form>
  );
}

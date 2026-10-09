'use client';

import { backupCodeRequestSchema, totpCodeRequestSchema } from '@pitchorium/contracts';
import { ShieldCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Form, FormActions, FormField, Input, OtpInput, useZodForm } from '@/components/ui';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';
import { authCall, useAuthFailureMessage } from '../../lib/auth-call';
import { AuthScreen } from './auth-screen';
import { landAfterSignIn } from './targets';

/**
 * Second step of a sign-in with a second factor: the six digits of the authenticator (sent as
 * soon as they are typed or pasted), or a backup code instead.
 */
export function TwoFactorScreen({ redirectTo }: { redirectTo: string | null }) {
  const t = useTranslations('web.auth.twoFactor');
  const [mode, setMode] = useState<'totp' | 'backup'>('totp');
  return (
    <AuthScreen
      icon={<ShieldCheck aria-hidden className="size-10 text-accent" />}
      title={t('title')}
      lede={t(mode === 'totp' ? 'totpLede' : 'backupLede')}
    >
      {mode === 'totp' ? (
        <TotpForm redirectTo={redirectTo} />
      ) : (
        <BackupCodeForm redirectTo={redirectTo} />
      )}
      <div className="grid gap-2 text-center text-sm">
        <Button
          type="button"
          variant="link"
          className="justify-self-center"
          onClick={() => setMode(mode === 'totp' ? 'backup' : 'totp')}
        >
          {t(mode === 'totp' ? 'useBackup' : 'useTotp')}
        </Button>
        <Link
          href={withRedirect(routes.signIn, redirectTo)}
          className="link-underline-hover text-accent"
        >
          {t('back')}
        </Link>
      </div>
    </AuthScreen>
  );
}

function TotpForm({ redirectTo }: { redirectTo: string | null }) {
  const t = useTranslations('web.auth.twoFactor');
  const locale = useLocale();
  const message = useAuthFailureMessage();
  const form = useZodForm(totpCodeRequestSchema, { defaultValues: { code: '' } });

  async function submit({ code }: { code: string }) {
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall((fetchOptions) =>
      authClient.twoFactor.verifyTotp({ code, fetchOptions }),
    );
    if (outcome.ok) {
      landAfterSignIn(locale, redirectTo);
      return;
    }
    form.setValue('code', '');
    form.setError('code', { type: 'server', message: message(outcome.failure) });
  }

  return (
    <Form form={form} onSubmit={submit} aria-label={t('totpLabel')}>
      <FormField
        control={form.control}
        name="code"
        label={t('totpLabel')}
        render={({ field }) => (
          <OtpInput {...field} onComplete={() => void form.handleSubmit(submit)()} />
        )}
      />
      <FormActions>
        <Button
          type="submit"
          className="w-full sm:w-auto"
          loading={form.formState.isSubmitting}
          loadingLabel={t('checking')}
        >
          {t('submit')}
        </Button>
      </FormActions>
    </Form>
  );
}

function BackupCodeForm({ redirectTo }: { redirectTo: string | null }) {
  const t = useTranslations('web.auth.twoFactor');
  const locale = useLocale();
  const message = useAuthFailureMessage();
  const form = useZodForm(backupCodeRequestSchema, { defaultValues: { code: '' } });

  async function submit({ code }: { code: string }) {
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall((fetchOptions) =>
      authClient.twoFactor.verifyBackupCode({ code, fetchOptions }),
    );
    if (outcome.ok) {
      landAfterSignIn(locale, redirectTo);
      return;
    }
    form.setError('code', { type: 'server', message: message(outcome.failure) });
  }

  return (
    <Form form={form} onSubmit={submit} aria-label={t('backupLabel')}>
      <FormField
        control={form.control}
        name="code"
        label={t('backupLabel')}
        render={({ field }) => (
          <Input {...field} autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} />
        )}
      />
      <FormActions>
        <Button
          type="submit"
          className="w-full sm:w-auto"
          loading={form.formState.isSubmitting}
          loadingLabel={t('checking')}
        >
          {t('submit')}
        </Button>
      </FormActions>
    </Form>
  );
}

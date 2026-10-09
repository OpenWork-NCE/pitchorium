'use client';

import {
  accountControllerCurrent,
  type LegalVersionsDtoOutput,
  meControllerMe,
} from '@pitchorium/api-client';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button, Spinner } from '@/components/ui';
import { routes } from '@/config/routes';
import type { PrerequisiteFormProps } from '@/features/access';
import { Link } from '@/i18n/navigation';
import { authCall, useAuthFailureMessage } from '../lib/auth-call';
import { absoluteUrl } from './auth/targets';
import { useCurrentMember } from './current-member';
import { LegalAcceptanceForm } from './onboarding/legal-acceptance-form';

/** Address to verify: a new link, then « C'est fait » checks the account again. */
function EmailVerifiedForm({ onDone }: PrerequisiteFormProps) {
  const t = useTranslations('web.prerequisites.email');
  const member = useCurrentMember();
  const locale = useLocale();
  const message = useAuthFailureMessage();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'checking' | 'pending'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState('sending');
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall((fetchOptions) =>
      authClient.sendVerificationEmail({
        email: member.user.email,
        callbackURL: absoluteUrl(locale, routes.emailVerified),
        fetchOptions,
      }),
    );
    setState(outcome.ok ? 'sent' : 'idle');
    setError(outcome.ok ? null : message(outcome.failure));
  }

  async function check() {
    setState('checking');
    const fresh = await meControllerMe();
    if (fresh.user.emailVerified) onDone();
    else setState('pending');
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm">{t('body', { email: member.user.email })}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          loading={state === 'sending'}
          loadingLabel={t('sending')}
          onClick={() => void send()}
        >
          {t('send')}
        </Button>
        <Button
          loading={state === 'checking'}
          loadingLabel={t('checking')}
          onClick={() => void check()}
        >
          {t('done')}
        </Button>
      </div>
      <p role="status" className="text-sm">
        {state === 'sent' ? t('sent') : state === 'pending' ? t('pending') : null}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Terms in force, accepted in place. */
function LegalForm({ onDone }: PrerequisiteFormProps) {
  const [versions, setVersions] = useState<LegalVersionsDtoOutput | null>(null);
  useEffect(() => {
    void accountControllerCurrent().then(setVersions);
  }, []);
  if (!versions) return <Spinner size="sm" />;
  return <LegalAcceptanceForm versions={versions} onAccepted={onDone} />;
}

/** The second factor is turned on in the security settings (QR code, backup codes). */
function TwoFactorForm(_: PrerequisiteFormProps) {
  const t = useTranslations('web.prerequisites.twoFactor');
  return (
    <div className="grid gap-4">
      <p className="text-sm">{t('body')}</p>
      <Button asChild>
        <Link href={routes.settingsSecurity}>{t('action')}</Link>
      </Button>
    </div>
  );
}

export { EmailVerifiedForm, LegalForm, TwoFactorForm };

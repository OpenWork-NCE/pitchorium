'use client';

import {
  changePasswordRequestSchema,
  passwordConfirmationRequestSchema,
  totpCodeRequestSchema,
} from '@pitchorium/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { lazy, Suspense, useState } from 'react';
import {
  Badge,
  Button,
  Callout,
  CopyButton,
  DrawnCheck,
  Form,
  FormActions,
  FormField,
  OtpInput,
  PasswordInput,
  RelativeTime,
  Skeleton,
  useZodForm,
} from '@/components/ui';
import { useRouter } from '@/i18n/navigation';
import { authCall, useAuthFailureMessage } from '../../lib/auth-call';
import { describeUserAgent } from '../../lib/user-agent';
import { useCurrentMember } from '../current-member';
import { useSignOut } from '../sign-out-button';

import { SettingsSection } from './settings-section';

/** The QR code (and its encoder) loads only when the second factor is being turned on. */
const QrCode = lazy(() => import('./qr-code').then((module) => ({ default: module.QrCode })));

/** Security (§7, §13): password, second factor, open sessions. */
export function SecuritySettings({ twoFactorRequired }: { twoFactorRequired: boolean }) {
  const t = useTranslations('web.settings.security');
  return (
    <div className="grid gap-6 *:min-w-0">
      {twoFactorRequired ? (
        <Callout title={t('twoFactorRequired.title')}>{t('twoFactorRequired.body')}</Callout>
      ) : null}
      <PasswordSection />
      <TwoFactorSection />
      <SessionsSection />
    </div>
  );
}

function PasswordSection() {
  const t = useTranslations('web.settings.security.password');
  const message = useAuthFailureMessage();
  const [done, setDone] = useState(false);
  const form = useZodForm(changePasswordRequestSchema, {
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  async function submit(values: { currentPassword: string; newPassword: string }) {
    setDone(false);
    const { authClient } = await import('@/lib/auth/client');
    // The api always closes the other sessions after a change (identity module).
    const outcome = await authCall((fetchOptions) =>
      authClient.changePassword({ ...values, revokeOtherSessions: true, fetchOptions }),
    );
    if (outcome.ok) {
      form.reset();
      setDone(true);
      return;
    }
    const code = outcome.failure.code?.toUpperCase();
    if (code === 'INVALID_PASSWORD') {
      form.setError('currentPassword', { type: code, message: message(outcome.failure) });
    } else if (code === 'PASSWORD_COMPROMISED' || code === 'PASSWORD_TOO_SHORT') {
      form.setError('newPassword', { type: code, message: message(outcome.failure) });
    } else {
      form.setError('root.server', { message: message(outcome.failure) });
    }
  }

  return (
    <SettingsSection id="password" title={t('title')} description={t('description')}>
      <Form form={form} onSubmit={submit} aria-label={t('title')}>
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <FormField
          control={form.control}
          name="currentPassword"
          label={t('current')}
          render={({ field }) => <PasswordInput {...field} autoComplete="current-password" />}
        />
        <FormField
          control={form.control}
          name="newPassword"
          label={t('new')}
          description={t('newHint')}
          render={({ field }) => <PasswordInput {...field} autoComplete="new-password" />}
        />
        <FormActions>
          <Button type="submit" loading={form.formState.isSubmitting} loadingLabel={t('saving')}>
            {t('submit')}
          </Button>
        </FormActions>
        <p role="status" className="text-sm text-success">
          {done ? t('done') : null}
        </p>
      </Form>
    </SettingsSection>
  );
}

type TwoFactorSetup = { totpURI: string; backupCodes: string[] };

/**
 * Second factor (TOTP): the password confirms the change, then a QR code (and the key to type by
 * hand), a first code to confirm, and the backup codes to keep. Turning it off asks for the
 * password again.
 */
function TwoFactorSection() {
  const t = useTranslations('web.settings.security.twoFactor');
  const member = useCurrentMember();
  const router = useRouter();
  const message = useAuthFailureMessage();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [step, setStep] = useState<'idle' | 'password' | 'scan' | 'codes' | 'disable'>('idle');
  const enabled = member.user.twoFactorEnabled;
  const passwordForm = useZodForm(passwordConfirmationRequestSchema, {
    defaultValues: { password: '' },
  });
  const codeForm = useZodForm(totpCodeRequestSchema, { defaultValues: { code: '' } });

  async function confirmPassword({ password }: { password: string }) {
    const { authClient } = await import('@/lib/auth/client');
    if (step === 'disable') {
      const outcome = await authCall((fetchOptions) =>
        authClient.twoFactor.disable({ password, fetchOptions }),
      );
      if (!outcome.ok) {
        passwordForm.setError('password', { type: 'server', message: message(outcome.failure) });
        return;
      }
      setStep('idle');
      router.refresh();
      return;
    }
    const outcome = await authCall<TwoFactorSetup>((fetchOptions) =>
      authClient.twoFactor.enable({ password, fetchOptions }),
    );
    if (!outcome.ok) {
      passwordForm.setError('password', { type: 'server', message: message(outcome.failure) });
      return;
    }
    setSetup(outcome.data);
    setStep('scan');
  }

  async function confirmCode({ code }: { code: string }) {
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall((fetchOptions) =>
      authClient.twoFactor.verifyTotp({ code, fetchOptions }),
    );
    if (!outcome.ok) {
      codeForm.setValue('code', '');
      codeForm.setError('code', { type: 'server', message: message(outcome.failure) });
      return;
    }
    setStep('codes');
  }

  const secret = setup ? (new URL(setup.totpURI).searchParams.get('secret') ?? '') : '';
  const codesText = setup?.backupCodes.join('\n') ?? '';

  return (
    <SettingsSection id="two-factor" title={t('title')} description={t('description')}>
      <p className="flex items-center gap-2 text-sm">
        <Badge tone={enabled ? 'success' : 'neutral'}>{t(enabled ? 'on' : 'off')}</Badge>
      </p>
      {step === 'idle' ? (
        <div>
          <Button
            variant={enabled ? 'outline' : 'primary'}
            onClick={() => {
              passwordForm.reset();
              setStep(enabled ? 'disable' : 'password');
            }}
          >
            {t(enabled ? 'disable' : 'enable')}
          </Button>
        </div>
      ) : null}
      {step === 'password' || step === 'disable' ? (
        <Form form={passwordForm} onSubmit={confirmPassword} aria-label={t('confirmPassword')}>
          <input type="text" name="username" autoComplete="username" hidden readOnly />
          <FormField
            control={passwordForm.control}
            name="password"
            label={t('confirmPassword')}
            description={t('confirmPasswordHint')}
            render={({ field }) => <PasswordInput {...field} autoComplete="current-password" />}
          />
          <FormActions>
            <Button
              type="submit"
              variant={step === 'disable' ? 'danger' : 'primary'}
              loading={passwordForm.formState.isSubmitting}
              loadingLabel={t('checking')}
            >
              {t(step === 'disable' ? 'disableConfirm' : 'continue')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep('idle')}>
              {t('cancel')}
            </Button>
          </FormActions>
        </Form>
      ) : null}
      {step === 'scan' && setup ? (
        <div className="grid gap-4">
          <ol className="grid list-decimal gap-2 pl-5 text-sm">
            <li>{t('scanStep')}</li>
            <li>{t('codeStep')}</li>
          </ol>
          <div className="flex flex-wrap items-center gap-4">
            <Suspense fallback={<Skeleton className="size-48" />}>
              <QrCode value={setup.totpURI} label={t('qrLabel')} />
            </Suspense>
            <div className="grid min-w-0 gap-1 text-sm">
              <span className="text-muted">{t('manualKey')}</span>
              <code className="font-mono break-all">{secret}</code>
              <CopyButton value={secret} label={t('copyKey')} />
            </div>
          </div>
          <Form form={codeForm} onSubmit={confirmCode} aria-label={t('codeLabel')}>
            <FormField
              control={codeForm.control}
              name="code"
              label={t('codeLabel')}
              render={({ field }) => (
                <OtpInput {...field} onComplete={() => void codeForm.handleSubmit(confirmCode)()} />
              )}
            />
            <FormActions>
              <Button
                type="submit"
                loading={codeForm.formState.isSubmitting}
                loadingLabel={t('checking')}
              >
                {t('activate')}
              </Button>
            </FormActions>
          </Form>
        </div>
      ) : null}
      {step === 'codes' && setup ? (
        <div className="grid gap-4">
          <div className="flex items-center gap-3">
            <DrawnCheck className="size-8" />
            <p className="font-medium">{t('activated')}</p>
          </div>
          <p className="text-sm">{t('backupCodes')}</p>
          <ul className="grid grid-cols-2 gap-2 rounded-md bg-surface-sunken p-4 font-mono text-sm sm:grid-cols-5">
            {setup.backupCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={codesText} label={t('copyCodes')} />
            <Button asChild variant="outline" size="sm">
              <a
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(codesText)}`}
                download="pitchorium-backup-codes.txt"
              >
                {t('downloadCodes')}
              </a>
            </Button>
          </div>
          <div>
            <Button
              onClick={() => {
                setStep('idle');
                setSetup(null);
                router.refresh();
              }}
            >
              {t('codesSaved')}
            </Button>
          </div>
        </div>
      ) : null}
    </SettingsSection>
  );
}

interface SessionRow {
  id: string;
  token: string;
  userAgent?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

const SESSIONS_KEY = ['identity', 'sessions'] as const;

/** Open sessions: device and last activity, revoked one by one, all others, or all of them. */
function SessionsSection() {
  const t = useTranslations('web.settings.security.sessions');
  const format = useFormatter();
  const queryClient = useQueryClient();
  const signOut = useSignOut();
  const message = useAuthFailureMessage();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessions = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: async () => {
      const { authClient } = await import('@/lib/auth/client');
      const [list, current] = await Promise.all([
        authClient.listSessions(),
        authClient.getSession(),
      ]);
      if (list.error) throw new Error(list.error.code ?? 'sessions');
      const rows = (list.data as SessionRow[]).toSorted(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      return { rows, currentToken: current.data?.session.token ?? null };
    },
  });

  async function run(key: string, call: () => Promise<{ ok: boolean } & object>) {
    setPending(key);
    setError(null);
    const outcome = (await call()) as Awaited<ReturnType<typeof authCall>>;
    setPending(null);
    if (!outcome.ok) setError(message(outcome.failure));
    await queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
  }

  const device = (userAgent: string | null | undefined) => {
    const { browser, system } = describeUserAgent(userAgent);
    if (browser && system) return t('device', { browser, system });
    return browser ?? system ?? t('unknownDevice');
  };

  return (
    <SettingsSection id="sessions" title={t('title')} description={t('description')}>
      {sessions.isPending ? (
        <Skeleton className="h-32" />
      ) : (
        <ul className="grid gap-2">
          {sessions.data?.rows.map((session) => {
            const current = session.token === sessions.data.currentToken;
            return (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="grid gap-0.5">
                  <span className="font-medium">
                    {device(session.userAgent)}{' '}
                    {current ? <Badge tone="accent">{t('thisDevice')}</Badge> : null}
                  </span>
                  <span className="text-sm text-muted">
                    {t('lastActive')}{' '}
                    <RelativeTime date={new Date(session.updatedAt).toISOString()} />
                    {' · '}
                    {t('opened', {
                      date: format.dateTime(new Date(session.createdAt), { dateStyle: 'medium' }),
                    })}
                  </span>
                </div>
                {current ? null : (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={pending === session.id}
                    loadingLabel={t('revoking')}
                    onClick={() =>
                      void run(session.id, async () => {
                        const { authClient } = await import('@/lib/auth/client');
                        return authCall((fetchOptions) =>
                          authClient.revokeSession({ token: session.token, fetchOptions }),
                        );
                      })
                    }
                  >
                    {t('revoke')}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 *:h-auto *:min-h-11 *:w-full *:py-2 *:whitespace-normal sm:flex-row sm:flex-wrap sm:*:w-auto">
        <Button
          variant="outline"
          loading={pending === 'others'}
          loadingLabel={t('revoking')}
          onClick={() =>
            void run('others', async () => {
              const { authClient } = await import('@/lib/auth/client');
              return authCall((fetchOptions) => authClient.revokeOtherSessions({ fetchOptions }));
            })
          }
        >
          {t('revokeOthers')}
        </Button>
        <Button
          variant="ghost"
          loading={pending === 'all'}
          loadingLabel={t('revoking')}
          onClick={() => {
            setPending('all');
            void (async () => {
              const { authClient } = await import('@/lib/auth/client');
              await authCall((fetchOptions) => authClient.revokeSessions({ fetchOptions }));
              await signOut();
            })();
          }}
        >
          {t('signOutEverywhere')}
        </Button>
      </div>
    </SettingsSection>
  );
}

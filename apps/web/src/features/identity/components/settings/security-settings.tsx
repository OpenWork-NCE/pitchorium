'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { lazy, Suspense, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Callout,
  CopyButton,
  DrawnCheck,
  Form,
  FormActions,
  FormField,
  Icon,
  OtpInput,
  PasswordInput,
  RelativeTime,
  Skeleton,
  useZodForm,
} from '@/components/ui';
import { routes } from '@/config/routes';
import { Link, useRouter } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';
import { type AuthFailure, authCall, useAuthFailureMessage } from '../../lib/auth-call';
import {
  changePasswordRequest,
  passwordConfirmationRequest,
  totpCodeRequest,
} from '../../lib/auth-schemas';
import { type DeviceKind, describeUserAgent } from '../../lib/user-agent';
import { useCurrentMember } from '../current-member';
import { useSignOut } from '../sign-out-button';

import { SettingsSection } from './settings-section';
import { useSignInMethods } from './sign-in-methods';

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
  const form = useZodForm(changePasswordRequest, {
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

type TwoFactorStep = 'idle' | 'password' | 'scan' | 'codes' | 'disable';

/**
 * Second factor (TOTP), asked after every sign-in (ADR 0108): the password confirms the change
 * when the account has one, a recent sign-in otherwise; then a QR code (and the key to type by
 * hand), a first code to confirm, and the backup codes to keep. Turning it off is confirmed the
 * same way.
 */
function TwoFactorSection() {
  const t = useTranslations('web.settings.security.twoFactor');
  const member = useCurrentMember();
  const router = useRouter();
  const locale = useLocale();
  const message = useAuthFailureMessage();
  const methods = useSignInMethods();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [step, setStep] = useState<TwoFactorStep>('idle');
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = member.user.twoFactorEnabled;
  // Until the methods are read, the password is asked: the api decides anyway.
  const hasPassword = methods.data?.some((account) => account.providerId === 'credential') ?? true;
  const passwordForm = useZodForm(passwordConfirmationRequest, {
    defaultValues: { password: '' },
  });
  const codeForm = useZodForm(totpCodeRequest, { defaultValues: { code: '' } });

  /** A refusal for an old session leads to a new sign-in, then back here. */
  function failed(failure: AuthFailure, password: boolean) {
    if (failure.code?.toUpperCase() === 'SESSION_NOT_FRESH') {
      setStale(true);
      setStep('idle');
    } else if (password) {
      passwordForm.setError('password', { type: 'server', message: message(failure) });
    } else {
      setError(message(failure));
    }
  }

  async function turnOn(password?: string) {
    setError(null);
    setStale(false);
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall<TwoFactorSetup>((fetchOptions) =>
      authClient.twoFactor.enable(password ? { password, fetchOptions } : { fetchOptions }),
    );
    if (!outcome.ok) return failed(outcome.failure, password !== undefined);
    setSetup(outcome.data);
    setStep('scan');
  }

  async function turnOff(password?: string) {
    setError(null);
    setStale(false);
    const { authClient } = await import('@/lib/auth/client');
    const outcome = await authCall((fetchOptions) =>
      authClient.twoFactor.disable(password ? { password, fetchOptions } : { fetchOptions }),
    );
    if (!outcome.ok) return failed(outcome.failure, password !== undefined);
    setStep('idle');
    router.refresh();
  }

  async function confirmPassword({ password }: { password: string }) {
    await (step === 'disable' ? turnOff(password) : turnOn(password));
  }

  async function withoutPassword(action: () => Promise<void>) {
    setBusy(true);
    await action();
    setBusy(false);
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
      {stale ? (
        <Alert
          tone="info"
          live="status"
          title={t('stale.title')}
          action={
            <Button asChild size="sm" variant="outline">
              <Link href={withRedirect(routes.signIn, `/${locale}${routes.settingsSecurity}`)}>
                {t('stale.action')}
              </Link>
            </Button>
          }
        >
          {t('stale.body')}
        </Alert>
      ) : null}
      {step === 'idle' ? (
        <div className="grid justify-items-start gap-2">
          {!hasPassword ? <p className="text-sm text-muted">{t('withoutPassword')}</p> : null}
          <Button
            variant={enabled ? 'outline' : 'primary'}
            className="h-auto min-h-11 py-2 whitespace-normal"
            loading={busy}
            loadingLabel={t('checking')}
            onClick={() => {
              passwordForm.reset();
              if (enabled) setStep('disable');
              else if (hasPassword) setStep('password');
              else void withoutPassword(() => turnOn());
            }}
          >
            {t(enabled ? 'disable' : 'enable')}
          </Button>
        </div>
      ) : null}
      {(step === 'password' || step === 'disable') && hasPassword ? (
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
      {step === 'disable' && !hasPassword ? (
        <div className="grid gap-3">
          <p className="text-sm">{t('disableQuestion')}</p>
          <FormActions>
            <Button
              variant="danger"
              loading={busy}
              loadingLabel={t('checking')}
              onClick={() => void withoutPassword(() => turnOff())}
            >
              {t('disableConfirm')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep('idle')}>
              {t('cancel')}
            </Button>
          </FormActions>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {step === 'scan' && setup ? (
        <div className="grid gap-4">
          <ol className="grid list-decimal gap-2 pl-5 text-sm">
            <li>{t('scanStep')}</li>
            <li>{t('codeStep')}</li>
          </ol>
          <div className="flex flex-wrap items-center gap-4">
            <Suspense fallback={<Skeleton className="size-48" data-loading="" />}>
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

const DEVICE_ICONS: Record<DeviceKind, typeof Monitor> = {
  computer: Monitor,
  phone: Smartphone,
  tablet: Tablet,
};

/**
 * Open sessions: kind of device, browser, system and last activity, revoked one by one, all
 * others, or all of them. No place: the address of a session is never located (ADR 0107).
 */
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

  /** « Téléphone · Safari, iOS »: the kind of device, then its browser and system, never a place. */
  const device = (userAgent: string | null | undefined) => {
    const { device: kind, browser, system } = describeUserAgent(userAgent);
    const software =
      browser && system ? t('device', { browser, system }) : (browser ?? system ?? null);
    const named = [kind ? t(`kinds.${kind}`) : null, software].filter(Boolean);
    return named.length > 0 ? named.join(' · ') : t('unknownDevice');
  };
  const glyph = (userAgent: string | null | undefined) =>
    DEVICE_ICONS[describeUserAgent(userAgent).device ?? 'computer'];

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
                <div className="flex min-w-0 items-start gap-3">
                  <Icon icon={glyph(session.userAgent)} className="mt-0.5 text-muted" />
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
          variant="danger"
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

'use client';

import { RotateCcw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Icon } from '@/components/ui';
import * as routes from '@/config/paths';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { withRedirect } from '@/lib/auth/redirect';
import { RESUME_PARAM, resumeAddress, withoutResume } from '../lib/resume';
import { useReauthenticationMinutes } from './console-access';
import { problemCodeOf } from './use-console-problem';

export type SensitiveOutcome<T> = { done: true; value: T } | { done: false };

/**
 * A sensitive action of the console (role, refund, flag, permanent suspension, freeze, retry,
 * ADR 0172): the api asks for a recent session (ACCESS_REAUTHENTICATION_REQUIRED). The refusal
 * shows the notice that leads to a new sign-in, which comes back to the same page with the
 * action open again (`?resume=<key>`): the existing mechanism of the personal data.
 */
export function useSensitiveAction(key: string): {
  /** The api asked for a new sign-in: the notice is shown. */
  stale: boolean;
  /** The page came back from the new sign-in for this action: open it again. */
  resumed: boolean;
  /**
   * Runs the call: `done` with its value, or not done when the api asked for a new sign-in
   * (`stale` is then set, the notice shown); any other refusal is thrown.
   */
  run: <T>(call: () => Promise<T>) => Promise<SensitiveOutcome<T>>;
  /** Called once the action is open again, to forget the resume parameter. */
  acknowledge: () => void;
} {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [stale, setStale] = useState(false);
  const resumed = params.get(RESUME_PARAM) === key;
  const acknowledge = useCallback(() => {
    if (!resumed) return;
    router.replace(withoutResume(pathname, params.toString()), { scroll: false });
  }, [params, pathname, resumed, router]);
  const run = useCallback(async <T,>(call: () => Promise<T>): Promise<SensitiveOutcome<T>> => {
    try {
      const value = await call();
      setStale(false);
      return { done: true, value };
    } catch (error) {
      if (problemCodeOf(error) === 'ACCESS_REAUTHENTICATION_REQUIRED') {
        setStale(true);
        return { done: false };
      }
      throw error;
    }
  }, []);
  return { stale, resumed, run, acknowledge };
}

/** Opens the action again when the page comes back from the new sign-in for it. */
export function useResumeEffect(resumed: boolean, open: () => void, acknowledge: () => void) {
  const latest = useRef({ open, acknowledge });
  useEffect(() => {
    latest.current = { open, acknowledge };
  });
  useEffect(() => {
    if (!resumed) return;
    latest.current.open();
    latest.current.acknowledge();
  }, [resumed]);
}

/**
 * The notice of a refusal for an old session: what is asked, why, and the sign-in that comes
 * back here with the action ready to resume.
 */
export function ReauthenticationNotice({ resumeKey }: { resumeKey: string }) {
  const t = useTranslations('web.admin.reauthentication');
  const minutes = useReauthenticationMinutes();
  const locale = useLocale();
  const pathname = usePathname();
  const params = useSearchParams();
  const back = resumeAddress(`/${locale}${pathname}`, params.toString(), resumeKey);
  return (
    <Alert tone="warning" title={t('title')} live="alert">
      <span className="grid gap-2">
        <span>{t('body', { minutes })}</span>
        <Link
          href={withRedirect(routes.signIn, back)}
          className="inline-flex items-center gap-1.5 link-underline-hover font-medium text-accent"
        >
          <Icon icon={RotateCcw} size="sm" />
          {t('action')}
        </Link>
      </span>
    </Alert>
  );
}

/** The hint of a sensitive action before it is asked: a new sign-in may be asked. */
export function RecentSessionHint() {
  const t = useTranslations('web.admin.reauthentication');
  const minutes = useReauthenticationMinutes();
  return <span className="text-sm text-muted">{t('hint', { minutes })}</span>;
}

'use client';

import type { AuthConfigurationDtoOutput } from '@pitchorium/api-client';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

type TurnstileSettings = NonNullable<AuthConfigurationDtoOutput['turnstile']>;

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** How long a submit waits for the challenge to finish before saying it failed. */
const CHALLENGE_WAIT_MS = 15_000;

let scriptLoading: Promise<TurnstileApi> | undefined;

/** Loads the script of Cloudflare once, on the screens that need it only (ADR 0103). */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'));
    script.onerror = () => {
      scriptLoading = undefined;
      reject(new Error('turnstile'));
    };
    document.head.append(script);
  });
  return scriptLoading;
}

export interface TurnstileState {
  /** Token of the last challenge passed, null while there is none (or Turnstile is off). */
  token: string | null;
  /** True when no token is needed or one is ready. */
  ready: boolean;
  /** A token is single use: a new challenge after each call. */
  reset: () => void;
  /**
   * The token of the next call: at once when ready, else once Cloudflare gives it (a submit made
   * while the challenge runs waits, at most CHALLENGE_WAIT_MS). `{ token: null }` when Turnstile
   * is off; null when no token came (failure or wait over).
   */
  challenge: () => Promise<{ token: string | null } | null>;
  /** The widget, to place in the form (empty when Turnstile is off). */
  widget: React.ReactNode;
}

/**
 * Cloudflare Turnstile of a form of /v1/auth, when the api requires it: discreet (shown only when
 * Cloudflare asks for an interaction) or managed, in the language and theme of the page.
 */
export function useTurnstile(settings: TurnstileSettings | null, action: string): TurnstileState {
  const t = useTranslations('web.auth.turnstile');
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  /** The submits waiting for a token, answered by the next one or a failure. */
  const waiting = useRef<((token: string | null) => void)[]>([]);
  const latest = useRef<string | null>(null);
  const settle = useCallback((value: string | null) => {
    latest.current = value;
    const pending = waiting.current;
    waiting.current = [];
    for (const answer of pending) answer(value);
  }, []);

  useEffect(() => {
    if (!settings || !container.current) return;
    let cancelled = false;
    const element = container.current;
    loadTurnstile().then(
      (api) => {
        if (cancelled) return;
        widgetId.current = api.render(element, {
          sitekey: settings.siteKey,
          appearance: settings.appearance,
          action,
          language: locale,
          theme: 'auto',
          callback: (value: string) => {
            setToken(value);
            setFailed(false);
            settle(value);
          },
          'expired-callback': () => {
            setToken(null);
            latest.current = null;
          },
          'error-callback': () => {
            setToken(null);
            setFailed(true);
            settle(null);
          },
        });
      },
      () => {
        if (cancelled) return;
        setFailed(true);
        settle(null);
      },
    );
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [settings, action, locale, settle]);

  const reset = useCallback(() => {
    setToken(null);
    latest.current = null;
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, []);

  const challenge = useCallback(async (): Promise<{ token: string | null } | null> => {
    if (!settings) return { token: null };
    if (latest.current) return { token: latest.current };
    const value = await new Promise<string | null>((resolve) => {
      const done = (answer: string | null) => {
        clearTimeout(timer);
        resolve(answer);
      };
      const timer = setTimeout(() => {
        waiting.current = waiting.current.filter((answer) => answer !== done);
        resolve(null);
      }, CHALLENGE_WAIT_MS);
      waiting.current.push(done);
    });
    return value ? { token: value } : null;
  }, [settings]);

  const widget = settings ? (
    <div className="grid gap-1">
      <div ref={container} data-turnstile="" className="min-h-0 empty:hidden" />
      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {t('failed')}
        </p>
      ) : null}
    </div>
  ) : null;

  return { token, ready: !settings || token !== null, reset, challenge, widget };
}

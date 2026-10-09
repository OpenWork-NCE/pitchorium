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
          },
          'expired-callback': () => setToken(null),
          'error-callback': () => {
            setToken(null);
            setFailed(true);
          },
        });
      },
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [settings, action, locale]);

  const reset = useCallback(() => {
    setToken(null);
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, []);

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

  return { token, ready: !settings || token !== null, reset, widget };
}

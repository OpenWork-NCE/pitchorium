'use client';

import type { Action, ConsoleCapabilities } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { createContext, type ReactNode, use } from 'react';
import { type ConsoleActionState, consoleActionState } from '../lib/console-access';

const ConsoleAccessContext = createContext<ConsoleCapabilities | null>(null);

/**
 * What the api lets the reader do in the console (`GET /v1/admin/capabilities`, read by the
 * layout before the render): every screen hides or disables its actions from it (ADR 0172).
 */
export function ConsoleAccessProvider({
  capabilities,
  children,
}: {
  capabilities: ConsoleCapabilities;
  children: ReactNode;
}) {
  return <ConsoleAccessContext value={capabilities}>{children}</ConsoleAccessContext>;
}

export interface ConsoleAction extends ConsoleActionState {
  /** Why it shows disabled, in words (`errors.<code>`), undefined when it is offered. */
  disabledReason: string | undefined;
}

/** How an action shows to the reader: hidden, disabled with its reason, or offered. */
export function useConsoleAction(action: Action): ConsoleAction {
  const capabilities = use(ConsoleAccessContext);
  const errors = useTranslations('errors');
  const state = consoleActionState(capabilities, action);
  return {
    ...state,
    disabledReason:
      state.visible && !state.allowed && state.code
        ? errors.has(state.code as never)
          ? errors(state.code as never)
          : errors('FORBIDDEN')
        : undefined,
  };
}

/** How each action shows to the reader, for a list of them (the navigation). */
export function useConsoleStates(): (action: Action) => ConsoleActionState {
  const capabilities = use(ConsoleAccessContext);
  return (action) => consoleActionState(capabilities, action);
}

/** Minutes a session stays recent enough for a sensitive action (the api decides them). */
export function useReauthenticationMinutes(): number {
  return use(ConsoleAccessContext)?.reauthenticationMaxAgeMinutes ?? 15;
}

/** The roles of the reader, to name them in the shell. */
export function useConsoleRoles(): readonly string[] {
  return use(ConsoleAccessContext)?.roles ?? [];
}

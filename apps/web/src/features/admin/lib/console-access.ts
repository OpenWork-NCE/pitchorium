import type { Action, ConsoleCapabilities } from '@pitchorium/contracts';

/** How the console offers an action, from what the api decided for the reader (ADR 0172). */
export interface ConsoleActionState {
  /** False when the role of the reader never gives the action (FORBIDDEN): it is not shown. */
  visible: boolean;
  /** Offered: allowed now, or after a new sign-in. */
  allowed: boolean;
  /** The refusal of the api when the action shows disabled (a missing second factor...). */
  code: string | null;
  /** Allowed once the reader signs in again (the session is too old). */
  reauthenticate: boolean;
  /** The action asks for a recent session (the dialog says it before the action). */
  recentAuthentication: boolean;
}

const HIDDEN: ConsoleActionState = {
  visible: false,
  allowed: false,
  code: 'FORBIDDEN',
  reauthenticate: false,
  recentAuthentication: false,
};

/**
 * The state of an action of the console: hidden when the role never gives it, disabled with the
 * refusal of the api when the reader may unlock it, offered otherwise. No rule of its own: the
 * answer of `GET /v1/admin/capabilities`, decided by the access policies.
 */
export function consoleActionState(
  capabilities: ConsoleCapabilities | null,
  action: Action,
): ConsoleActionState {
  const entry = capabilities?.actions.find((candidate) => candidate.action === action);
  if (!entry) return HIDDEN;
  const recentAuthentication = entry.recentAuthentication;
  if (entry.allowed) {
    return {
      visible: true,
      allowed: true,
      code: null,
      reauthenticate: false,
      recentAuthentication,
    };
  }
  if (entry.code === 'ACCESS_REAUTHENTICATION_REQUIRED') {
    return {
      visible: true,
      allowed: true,
      code: entry.code,
      reauthenticate: true,
      recentAuthentication,
    };
  }
  if (entry.code === 'FORBIDDEN' || entry.code === null) return { ...HIDDEN, recentAuthentication };
  return {
    visible: true,
    allowed: false,
    code: entry.code,
    reauthenticate: false,
    recentAuthentication,
  };
}

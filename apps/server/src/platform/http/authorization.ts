import { applyDecorators, SetMetadata, type Type } from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import type { Action } from '@pitchorium/contracts';
import type { Request } from 'express';
import type { Principal } from './principal';

/** Resource an action applies to; `ownerId` drives ownership policies. */
export interface ProtectedResource {
  type: string;
  id: string;
  ownerId: string | null;
}

/**
 * Loads the resource targeted by a request. Returning null answers 404 before the policy runs,
 * so that a forbidden resource and a missing one look the same.
 */
export interface ResourceResolver {
  resolve(request: Request, principal: Principal): Promise<ProtectedResource | null>;
}

export interface RequiredAction {
  action: Action;
  /** Defaults to the principal's own account. */
  resource?: Type<ResourceResolver>;
}

export const REQUIRED_ACTION_KEY = 'pitchorium:required-action';

export const SESSION_COOKIE_SECURITY = 'session';

/**
 * Declares the action a route performs. The authentication guard of the access module rejects
 * protected routes without one (deny by default) and evaluates the action policy.
 */
export function RequireAction(
  action: Action,
  options: Omit<RequiredAction, 'action'> = {},
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(REQUIRED_ACTION_KEY, { action, ...options } satisfies RequiredAction),
    ApiCookieAuth(SESSION_COOKIE_SECURITY),
  );
}

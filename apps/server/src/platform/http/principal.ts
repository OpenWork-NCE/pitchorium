import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** Authenticated principal attached to the request by the authentication guard. */
export interface Principal {
  userId: string;
  sessionId: string;
}

const PRINCIPAL = Symbol('pitchorium.principal');

type WithPrincipal = { [PRINCIPAL]?: Principal };

export function setPrincipal(request: object, principal: Principal): void {
  (request as WithPrincipal)[PRINCIPAL] = principal;
}

export function getPrincipal(request: object): Principal | undefined {
  return (request as WithPrincipal)[PRINCIPAL];
}

/**
 * Injects the authenticated principal. Only valid on protected routes, where the guard has
 * already rejected anonymous requests.
 */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const principal = getPrincipal(context.switchToHttp().getRequest<object>());
    if (!principal) {
      throw new Error('CurrentPrincipal used on a route without an authenticated principal');
    }
    return principal;
  },
);

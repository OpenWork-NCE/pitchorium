import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Actor } from '../domain/actor';

const ACTOR = Symbol('pitchorium.actor');

export function setActor(request: object, actor: Actor): void {
  (request as { [ACTOR]?: Actor })[ACTOR] = actor;
}

export function getActor(request: object): Actor | undefined {
  return (request as { [ACTOR]?: Actor })[ACTOR];
}

/** Injects the authenticated actor (roles, trust facts) on a protected route. */
export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const actor = getActor(context.switchToHttp().getRequest<object>());
  if (!actor) throw new Error('CurrentActor used on a route without an authenticated actor');
  return actor;
});

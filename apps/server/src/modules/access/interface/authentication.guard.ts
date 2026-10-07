import { type CanActivate, type ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import {
  PUBLIC_ROUTE_KEY,
  REQUIRED_ACTION_KEY,
  type RequiredAction,
  type ResourceResolver,
  setPrincipal,
  TrustedOrigins,
} from '../../../platform/http';
import { DomainError } from '../../../platform/kernel';
import { SessionAuthenticator } from '../../identity';
import { AccessService, selfResource } from '../application/access.service';
import { setActor } from './current-actor.decorator';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global guard of the api (deny by default):
 * 1. cookie-authenticated writes must come from a trusted Origin (CSRF);
 * 2. routes not marked @Public() require a session;
 * 3. they must declare an action with @RequireAction(), whose policy is then enforced.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  private readonly logger = new Logger(AuthenticationGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
    private readonly sessions: SessionAuthenticator,
    private readonly access: AccessService,
    private readonly origins: TrustedOrigins,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const targets = [context.getHandler(), context.getClass()];

    if (
      !SAFE_METHODS.has(request.method) &&
      this.sessions.hasSessionCookie(request.headers) &&
      !this.origins.allows(request.headers)
    ) {
      throw new DomainError('ACCESS_ORIGIN_NOT_ALLOWED', 'Untrusted origin for a cookie request');
    }
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, targets)) return true;

    const session = await this.sessions.authenticate(request.headers);
    if (!session) throw new DomainError('UNAUTHENTICATED', 'Authentication required');
    for (const cookie of session.setCookies) response.append('Set-Cookie', cookie);
    const principal = { userId: session.user.id, sessionId: session.sessionId };
    const actor = await this.access.actorFor(session);
    setPrincipal(request, principal);
    setActor(request, actor);

    const required = this.reflector.getAllAndOverride<RequiredAction | undefined>(
      REQUIRED_ACTION_KEY,
      targets,
    );
    if (!required) {
      this.logger.error(`${request.method} ${request.path} declares no action: refused`);
      throw new DomainError('FORBIDDEN', 'Route has no access policy');
    }
    let resource = selfResource(actor);
    if (required.resource) {
      const resolver = this.moduleRef.get<ResourceResolver>(required.resource, { strict: false });
      const resolved = await resolver.resolve(request, principal);
      if (!resolved) throw new DomainError('NOT_FOUND', 'Resource not found');
      resource = resolved;
    }
    await this.access.assert(
      actor,
      required.action,
      resource,
      typeof request.id === 'string' ? request.id : undefined,
    );
    return true;
  }
}

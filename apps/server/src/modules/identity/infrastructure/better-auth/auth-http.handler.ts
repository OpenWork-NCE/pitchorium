import type { IncomingMessage, ServerResponse } from 'node:http';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { getRequest, setResponse } from 'better-call/node';
import type { Request as ExpressRequest } from 'express';
import { API_CONFIG, type ApiConfig } from '../../../../platform/config';
import {
  RawHttpHandler,
  type RawHttpRequestHandler,
  resolveRequestId,
  TrustedOrigins,
} from '../../../../platform/http';
import { ErrorReporter } from '../../../../platform/observability';
import { AuthRequestScope } from './auth-request-scope';
import { AUTH_BASE_PATH, type BetterAuthInstance, CLIENT_IP_HEADER } from './better-auth.factory';
import { BETTER_AUTH } from './better-auth.provider';

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/** `/v1/auth/callback/google?code=...` gives `/callback/google`. */
function authPath(url: string): string {
  const { pathname } = new URL(url);
  return pathname.startsWith(AUTH_BASE_PATH) ? pathname.slice(AUTH_BASE_PATH.length) : pathname;
}

/**
 * Serves /v1/auth with Better Auth, mounted before the body parsers (ADR 0013). No transaction
 * spans the request: each Better Auth write commits with its identity event in a short
 * transaction (ADR 0019), so that no connection is held during a call to an OAuth provider.
 */
@Injectable()
@RawHttpHandler({ path: AUTH_BASE_PATH })
export class AuthHttpHandler implements RawHttpRequestHandler {
  private readonly logger = new Logger(AuthHttpHandler.name);

  constructor(
    @Inject(BETTER_AUTH) private readonly auth: BetterAuthInstance,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
    private readonly scope: AuthRequestScope,
    private readonly errorReporter: ErrorReporter,
    private readonly origins: TrustedOrigins,
  ) {}

  async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const startedAt = performance.now();
    resolveRequestId(request, response);
    // Every write must come from the web app (CSRF, login CSRF): Better Auth itself does not
    // check the Origin on every endpoint (sign-out, for example).
    if (!SAFE_METHODS.has(request.method ?? 'GET') && !this.origins.allows(request.headers)) {
      await setResponse(
        response,
        Response.json(
          { code: 'ACCESS_ORIGIN_NOT_ALLOWED', message: 'Untrusted origin' },
          { status: 403 },
        ),
      );
      return;
    }
    // Only the address resolved by Express (trust proxy) is used for rate limiting.
    request.headers[CLIENT_IP_HEADER] = (request as ExpressRequest).ip ?? '';

    const webRequest = getRequest({ base: this.config.http.publicUrl, request });
    const state = AuthRequestScope.newState(authPath(webRequest.url));
    let result: Response;
    try {
      result = await this.scope.run(state, () => this.auth.handler(webRequest));
    } catch (error) {
      result = this.failure(error);
    }
    // A failed request sends no email: its writes may be partial.
    if (result.status >= 500) state.afterResponse.length = 0;

    await setResponse(response, result);
    this.scope.flush(state);
    this.logger.log(
      `${request.method} ${(request as ExpressRequest).originalUrl.split('?')[0]} ${result.status} ${Math.round(performance.now() - startedAt)}ms`,
    );
  }

  private failure(error: unknown): Response {
    this.logger.error(error);
    this.errorReporter.capture(error);
    return Response.json({ code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

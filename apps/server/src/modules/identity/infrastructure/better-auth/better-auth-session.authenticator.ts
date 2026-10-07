import type { IncomingHttpHeaders } from 'node:http';
import { Inject, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { IdentityUserRepository } from '../../application/identity-user.repository';
import {
  type AuthenticatedSession,
  SessionAuthenticator,
} from '../../application/session-authenticator';
import { AUTH_COOKIE_PREFIX, type BetterAuthInstance } from './better-auth.factory';
import { BETTER_AUTH } from './better-auth.provider';

const SESSION_COOKIE_PATTERN = new RegExp(
  `(?:^|;\\s*)(?:__Secure-)?${AUTH_COOKIE_PREFIX}\\.session_token=`,
);

@Injectable()
export class BetterAuthSessionAuthenticator extends SessionAuthenticator {
  constructor(
    @Inject(BETTER_AUTH) private readonly auth: BetterAuthInstance,
    private readonly users: IdentityUserRepository,
  ) {
    super();
  }

  hasSessionCookie(headers: IncomingHttpHeaders): boolean {
    return SESSION_COOKIE_PATTERN.test(headers.cookie ?? '');
  }

  async authenticate(headers: IncomingHttpHeaders): Promise<AuthenticatedSession | null> {
    if (!this.hasSessionCookie(headers)) return null;
    const { headers: responseHeaders, response } = await this.auth.api.getSession({
      headers: fromNodeHeaders(headers),
      returnHeaders: true,
    });
    if (!response) return null;
    const user = await this.users.findById(response.user.id);
    if (!user) return null;
    return {
      sessionId: response.session.id,
      user,
      setCookies: responseHeaders.getSetCookie(),
    };
  }
}

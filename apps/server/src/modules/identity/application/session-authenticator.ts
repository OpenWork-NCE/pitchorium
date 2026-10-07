import type { IncomingHttpHeaders } from 'node:http';
import type { IdentityUser } from './identity-user.repository';

export interface AuthenticatedSession {
  sessionId: string;
  user: IdentityUser;
  /** Set-Cookie headers to forward when the session expiry was extended. */
  setCookies: string[];
}

/** Port (api only): resolves the session carried by the request cookies. */
export abstract class SessionAuthenticator {
  abstract authenticate(headers: IncomingHttpHeaders): Promise<AuthenticatedSession | null>;
  /** True when the request carries a session cookie, valid or not. */
  abstract hasSessionCookie(headers: IncomingHttpHeaders): boolean;
}

import { Inject, Injectable } from '@nestjs/common';
import { API_CONFIG, type ApiConfig } from '../config';

/**
 * Origins allowed to send writes to the api and to open member sockets (CSRF and cross-site
 * WebSocket hijacking protection): AUTH_TRUSTED_ORIGINS, the web app and the api itself.
 */
@Injectable()
export class TrustedOrigins {
  private readonly origins: ReadonlySet<string>;

  constructor(@Inject(API_CONFIG) config: ApiConfig) {
    this.origins = new Set(
      [...config.auth.trustedOrigins, config.webAppUrl, config.http.publicUrl].map(
        (url) => new URL(url).origin,
      ),
    );
  }

  /** Origin header first, Referer as a fallback; a request with neither is refused. */
  allows(headers: { origin?: string | undefined; referer?: string | undefined }): boolean {
    const candidate = headers.origin ?? headers.referer;
    if (!candidate || candidate === 'null') return false;
    try {
      return this.origins.has(new URL(candidate).origin);
    } catch {
      return false;
    }
  }
}

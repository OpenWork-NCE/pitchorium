import { Inject, Injectable, Logger } from '@nestjs/common';
import { API_CONFIG, type ApiConfig } from '../config';
import { DomainError } from '../kernel';

/** Header carrying the Turnstile token, the same as on the /v1/auth routes (Better Auth). */
export const CAPTCHA_RESPONSE_HEADER = 'x-captcha-response';

export const TURNSTILE_SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Longest token Cloudflare issues; a longer value is refused without calling it. */
export const TURNSTILE_TOKEN_MAX_LENGTH = 2048;

/** Same deadline as the captcha plugin of Better Auth: a hanging provider fails closed. */
const VERIFY_TIMEOUT_MS = 10_000;

interface SiteverifyResponse {
  success?: boolean;
  'error-codes'?: string[];
}

/**
 * Cloudflare Turnstile for the public routes outside /v1/auth (ADR 0103): without keys (local,
 * tests) every request passes; with keys, a missing token is `CAPTCHA_REQUIRED`, a rejected one
 * `CAPTCHA_FAILED`, and an unreachable Cloudflare `SERVICE_UNAVAILABLE` (fails closed).
 */
@Injectable()
export class TurnstileVerifier {
  private readonly logger = new Logger(TurnstileVerifier.name);

  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  get enabled(): boolean {
    return this.config.auth.turnstile !== undefined;
  }

  async verify(token: string | undefined, remoteIp: string | undefined): Promise<void> {
    const settings = this.config.auth.turnstile;
    if (!settings) return;
    if (!token) throw new DomainError('CAPTCHA_REQUIRED', 'Turnstile token is missing');
    if (token.length > TURNSTILE_TOKEN_MAX_LENGTH) {
      throw new DomainError('CAPTCHA_FAILED', 'Turnstile token too long');
    }
    let answer: SiteverifyResponse;
    try {
      const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          secret: settings.secretKey,
          response: token,
          ...(remoteIp ? { remoteip: remoteIp } : {}),
        }),
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`siteverify answered ${response.status}`);
      answer = (await response.json()) as SiteverifyResponse;
    } catch (error) {
      this.logger.error(`Turnstile unavailable: ${(error as Error).message}`);
      throw new DomainError('SERVICE_UNAVAILABLE', 'Anti-spam check unavailable');
    }
    if (answer.success !== true) {
      this.logger.warn(`Turnstile rejected a token: ${(answer['error-codes'] ?? []).join(', ')}`);
      throw new DomainError('CAPTCHA_FAILED', 'Turnstile token rejected');
    }
  }
}

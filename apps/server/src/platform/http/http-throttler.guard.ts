import { createHash } from 'node:crypto';
import { type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { API_CONFIG, type ApiConfig } from '../config';
import { CLIENT_ADDRESS_HEADER, verifiedClientAddress } from './client-address';
import { signedSessionToken } from './session-cookie';

/**
 * Rate limiting of HTTP (WebSocket gateways get their own policy): per session for a request
 * that carries a validly signed session cookie, per address otherwise. The pages rendered by the
 * web server call the api from its own address on behalf of every member: counted per address,
 * all of them would share one limit (ADR 0114). A visitor without a session is counted by the
 * address the web server relays in a signed header, when it is valid (ADR 0115).
 */
@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {
    super(options, storage, reflector);
  }

  override canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return Promise.resolve(true);
    }
    return super.canActivate(context);
  }

  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    const headers = request['headers'] as Record<string, string | string[] | undefined> | undefined;
    const cookie = headers?.['cookie'];
    const token = signedSessionToken(
      typeof cookie === 'string' ? cookie : undefined,
      this.config.auth.secret,
    );
    if (token) {
      return Promise.resolve(`session:${createHash('sha256').update(token).digest('hex')}`);
    }
    const secret = this.config.http.clientAddressSecret;
    const relayed = secret
      ? verifiedClientAddress(headers?.[CLIENT_ADDRESS_HEADER], secret, Date.now())
      : null;
    if (relayed) return Promise.resolve(relayed);
    return super.getTracker(request);
  }
}

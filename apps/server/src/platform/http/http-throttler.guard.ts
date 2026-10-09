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
import { signedSessionToken } from './session-cookie';

/**
 * Rate limiting of HTTP (WebSocket gateways get their own policy): per session for a request
 * that carries a validly signed session cookie, per address otherwise. The pages rendered by the
 * web server call the api from its own address on behalf of every member: counted per address,
 * all of them would share one limit (ADR 0114).
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
    const headers = request['headers'] as { cookie?: string } | undefined;
    const token = signedSessionToken(headers?.cookie, this.config.auth.secret);
    if (token) {
      return Promise.resolve(`session:${createHash('sha256').update(token).digest('hex')}`);
    }
    return super.getTracker(request);
  }
}

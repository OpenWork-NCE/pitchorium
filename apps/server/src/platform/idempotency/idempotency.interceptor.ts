import {
  type CallHandler,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { catchError, from, mergeMap, type Observable, of } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config';
import { getPrincipal } from '../http/principal';
import { DomainError } from '../kernel';
import { fingerprintRequest, IdempotencyService } from './idempotency.service';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const IDEMPOTENT_REPLAYED_HEADER = 'Idempotent-Replayed';
const KEY_PATTERN = /^[\x21-\x7E]{1,255}$/;

/**
 * Implements the Idempotency-Key header (IETF httpapi draft) for JSON write endpoints.
 * Apply it with the @Idempotent() decorator.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly idempotency: IdempotencyService,
    private readonly reflector: Reflector,
    @Inject(API_CONFIG) private readonly config: ApiConfig,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const key = request.header(IDEMPOTENCY_KEY_HEADER);
    if (!key || !KEY_PATTERN.test(key)) {
      throw new DomainError(
        'IDEMPOTENCY_KEY_MISSING',
        'Missing or malformed Idempotency-Key header',
      );
    }

    // Keys are scoped by principal: two users may legitimately pick the same key.
    const routePath = `${request.baseUrl}${(request.route as { path?: string } | undefined)?.path ?? request.path}`;
    const scope = `${getPrincipal(request)?.userId ?? 'anonymous'} ${request.method} ${routePath}`;
    const fingerprint = fingerprintRequest(request.method, request.originalUrl, request.body);
    const status =
      this.reflector.get<number | undefined>(HTTP_CODE_METADATA, context.getHandler()) ??
      (request.method === 'POST' ? HttpStatus.CREATED : HttpStatus.OK);

    return from(
      this.idempotency.claim(scope, key, fingerprint, this.config.idempotency.ttlMs),
    ).pipe(
      mergeMap((claim) => {
        switch (claim.kind) {
          case 'replay':
            response.setHeader(IDEMPOTENT_REPLAYED_HEADER, 'true');
            response.status(claim.status);
            return of(claim.body);
          case 'in-progress':
            throw new DomainError('IDEMPOTENCY_REQUEST_IN_PROGRESS', 'Request still in progress');
          case 'mismatch':
            throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'Key reused with a different request');
          case 'acquired':
            return next.handle().pipe(
              mergeMap(async (body: unknown) => {
                await this.idempotency.complete(scope, key, status, body);
                return body;
              }),
              catchError(async (error: unknown) => {
                await this.idempotency.release(scope, key);
                throw error;
              }),
            );
        }
      }),
    );
  }
}

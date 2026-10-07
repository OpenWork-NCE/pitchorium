import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import { IdempotencyInterceptor } from './idempotency.interceptor';

/** Makes a write endpoint idempotent: it then requires the Idempotency-Key header. */
export function Idempotent(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    UseInterceptors(IdempotencyInterceptor),
    ApiHeader({
      name: 'Idempotency-Key',
      required: true,
      description:
        'Client-generated unique key (UUIDv7 recommended). Replays return the stored response.',
    }),
  );
}

import { HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import {
  type ErrorCode,
  errorCodes,
  PROBLEM_TYPE_PREFIX,
  type ProblemDetails,
  type ValidationIssue,
} from '@pitchorium/contracts';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { DomainError } from '../kernel';

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

function escapePointerSegment(segment: PropertyKey): string {
  return String(segment).replaceAll('~', '~0').replaceAll('/', '~1');
}

export function toValidationIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    pointer: `/${issue.path.map(escapePointerSegment).join('/')}`,
    code: issue.code,
  }));
}

/** Errors raised by Express middlewares (body parser) carry an HTTP status but no Nest type. */
function middlewareStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const status =
    (exception as { status?: unknown; statusCode?: unknown }).status ??
    (exception as { statusCode?: unknown }).statusCode;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

export function problemFromCode(
  code: ErrorCode,
  extras: Partial<Pick<ProblemDetails, 'detail' | 'errors' | 'status'>> = {},
): ProblemDetails {
  const definition = errorCodes[code];
  return {
    type: `${PROBLEM_TYPE_PREFIX}${code.toLowerCase().replaceAll('_', '-')}`,
    title: definition.title,
    status: extras.status ?? definition.status,
    code,
    ...(extras.detail ? { detail: extras.detail } : {}),
    ...(extras.errors ? { errors: extras.errors } : {}),
  };
}

/**
 * Maps any thrown value to a problem. Only DomainError messages are exposed as `detail`:
 * framework and unknown errors never leak their message.
 */
export function toProblem(exception: unknown): ProblemDetails {
  if (exception instanceof DomainError) {
    return problemFromCode(exception.code, { detail: exception.message });
  }
  if (exception instanceof ZodValidationException) {
    const zodError = exception.getZodError();
    return problemFromCode('VALIDATION_FAILED', {
      ...(zodError instanceof ZodError ? { errors: toValidationIssues(zodError) } : {}),
    });
  }
  if (exception instanceof ThrottlerException) {
    return problemFromCode('RATE_LIMITED');
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code = STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
    return problemFromCode(code, { status });
  }
  const status = middlewareStatus(exception);
  if (status !== undefined) {
    return problemFromCode(STATUS_TO_CODE[status] ?? 'BAD_REQUEST', { status });
  }
  return problemFromCode('INTERNAL_ERROR');
}

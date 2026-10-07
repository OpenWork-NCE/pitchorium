import { z } from 'zod';

export interface ErrorCodeDefinition {
  readonly status: number;
  readonly title: string;
}

/**
 * Single registry of stable error codes. Clients translate codes, never titles.
 * Module codes are prefixed with the module name, for example PROJECTS_CAMPAIGN_CLOSED.
 */
export const errorCodes = {
  BAD_REQUEST: { status: 400, title: 'Bad request' },
  VALIDATION_FAILED: { status: 400, title: 'Validation failed' },
  IDEMPOTENCY_KEY_MISSING: { status: 400, title: 'Idempotency-Key header is required' },
  UNAUTHENTICATED: { status: 401, title: 'Authentication required' },
  FORBIDDEN: { status: 403, title: 'Forbidden' },
  NOT_FOUND: { status: 404, title: 'Resource not found' },
  CONFLICT: { status: 409, title: 'Conflict' },
  IDEMPOTENCY_REQUEST_IN_PROGRESS: {
    status: 409,
    title: 'A request with this Idempotency-Key is still being processed',
  },
  PAYLOAD_TOO_LARGE: { status: 413, title: 'Payload too large' },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, title: 'Unsupported media type' },
  IDEMPOTENCY_KEY_REUSED: {
    status: 422,
    title: 'Idempotency-Key was already used with a different request',
  },
  RATE_LIMITED: { status: 429, title: 'Too many requests' },
  INTERNAL_ERROR: { status: 500, title: 'Internal error' },
  SERVICE_UNAVAILABLE: { status: 503, title: 'Service unavailable' },
} as const satisfies Record<string, ErrorCodeDefinition>;

export type ErrorCode = keyof typeof errorCodes;

export const errorCodeSchema = z.enum(Object.keys(errorCodes) as [ErrorCode, ...ErrorCode[]]);

export function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(errorCodes, value);
}

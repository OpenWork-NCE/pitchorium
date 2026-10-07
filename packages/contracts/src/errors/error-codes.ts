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
  IDENTITY_USER_NOT_FOUND: { status: 404, title: 'User not found' },
  IDENTITY_LEGAL_VERSION_OUTDATED: {
    status: 409,
    title: 'The accepted legal document version is not the current one',
  },
  IDENTITY_LOCALE_NOT_ACTIVE: { status: 422, title: 'Locale is not active' },
  ACCESS_ORIGIN_NOT_ALLOWED: { status: 403, title: 'Request origin is not allowed' },
  ACCESS_PREREQUISITES_MISSING: { status: 403, title: 'Action prerequisites are missing' },
  ACCESS_ACCOUNT_SUSPENDED: { status: 403, title: 'Account is suspended' },
  ACCESS_LAST_ADMIN: { status: 409, title: 'The last administrator cannot be removed' },
  PROFILES_PROFILE_NOT_FOUND: { status: 404, title: 'Profile not found' },
  PROFILES_FACET_NOT_FOUND: { status: 404, title: 'Profile facet not found' },
  PROFILES_FACET_ALREADY_EXISTS: { status: 409, title: 'Profile facet already exists' },
  PROFILES_HANDLE_TAKEN: { status: 409, title: 'Handle is already taken' },
  PROFILES_HANDLE_RESERVED: { status: 409, title: 'Handle is reserved' },
  PROFILES_COMPANY_COUNTRY_NOT_ELIGIBLE: {
    status: 422,
    title: 'Company country must be in Africa or the Caribbean',
  },
  PROFILES_CONTRIBUTOR_HAT_REQUIRED: {
    status: 422,
    title: 'At least one contributor hat is required',
  },
  PROFILES_TICKET_RANGE_INVALID: { status: 422, title: 'Investment ticket range is invalid' },
  PROFILES_UNKNOWN_REFERENCE: { status: 422, title: 'Unknown reference data code' },
  INTERNAL_ERROR: { status: 500, title: 'Internal error' },
  SERVICE_UNAVAILABLE: { status: 503, title: 'Service unavailable' },
} as const satisfies Record<string, ErrorCodeDefinition>;

export type ErrorCode = keyof typeof errorCodes;

export const errorCodeSchema = z.enum(Object.keys(errorCodes) as [ErrorCode, ...ErrorCode[]]);

export function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(errorCodes, value);
}

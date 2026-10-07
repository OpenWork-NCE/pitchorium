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
  MEDIA_NOT_FOUND: { status: 404, title: 'Media not found' },
  MEDIA_TYPE_NOT_ALLOWED: { status: 422, title: 'File type not allowed for this usage' },
  MEDIA_TOO_LARGE: { status: 422, title: 'File exceeds the maximum size of this usage' },
  MEDIA_QUOTA_EXCEEDED: { status: 422, title: 'Storage quota exceeded' },
  MEDIA_UPLOAD_MISSING: { status: 409, title: 'File not uploaded yet' },
  MEDIA_INVALID_STATE: { status: 409, title: 'Operation not allowed in the current media status' },
  MEDIA_NOT_READY: { status: 409, title: 'Media is not ready' },
  MEDIA_USAGE_MISMATCH: { status: 422, title: 'Media was uploaded for another usage' },
  MEDIA_LIMIT_REACHED: { status: 409, title: 'Maximum number of files reached for this resource' },
  MEDIA_ATTACHED: { status: 409, title: 'Media is attached to a resource' },
  PROFILES_ORGANIZATION_NOT_ALLOWED: {
    status: 422,
    title: 'Only an organization of which the member is a member can be linked',
  },
  ORGANIZATIONS_NOT_FOUND: { status: 404, title: 'Organization not found' },
  ORGANIZATIONS_SLUG_TAKEN: { status: 409, title: 'Organization slug is already taken' },
  ORGANIZATIONS_SLUG_RESERVED: { status: 409, title: 'Organization slug is reserved' },
  ORGANIZATIONS_CREATION_LIMIT_REACHED: {
    status: 422,
    title: 'Maximum number of created organizations reached',
  },
  ORGANIZATIONS_MEMBER_NOT_FOUND: { status: 404, title: 'Organization member not found' },
  ORGANIZATIONS_ALREADY_MEMBER: { status: 409, title: 'Already a member of the organization' },
  ORGANIZATIONS_LAST_OWNER: { status: 409, title: 'An organization keeps at least one owner' },
  ORGANIZATIONS_ROLE_CHANGE_FORBIDDEN: {
    status: 403,
    title: 'Role change not allowed for this member',
  },
  ORGANIZATIONS_INVITATION_INVALID: {
    status: 410,
    title: 'Invitation is invalid, expired or already used',
  },
  ORGANIZATIONS_INVITATION_EMAIL_MISMATCH: {
    status: 403,
    title: 'Invitation was sent to another email address',
  },
  ORGANIZATIONS_VERIFICATION_INVALID_STATE: {
    status: 409,
    title: 'Verification step not allowed in the current status',
  },
  ORGANIZATIONS_VERIFICATION_REQUEST_NOT_FOUND: {
    status: 404,
    title: 'Verification request not found',
  },
  ORGANIZATIONS_VERIFICATION_CRITERION_UNKNOWN: {
    status: 422,
    title: 'Unknown verification criterion',
  },
  NETWORK_TARGET_NOT_FOUND: { status: 404, title: 'Follow target not found' },
  NETWORK_MEMBER_NOT_FOUND: { status: 404, title: 'Member not found' },
  NETWORK_SELF_RELATION: { status: 422, title: 'A member cannot relate to themselves' },
  NETWORK_ALREADY_CONNECTED: { status: 409, title: 'Members are already connected' },
  NETWORK_REQUEST_ALREADY_PENDING: {
    status: 409,
    title: 'A connection request is already pending between these members',
  },
  NETWORK_REQUEST_COOLDOWN: {
    status: 409,
    title: 'A new request to this member is not allowed yet after a decline',
  },
  NETWORK_WEEKLY_REQUEST_LIMIT: {
    status: 429,
    title: 'Weekly limit of connection requests reached',
  },
  NETWORK_REQUEST_NOT_FOUND: { status: 404, title: 'Connection request not found' },
  NETWORK_REQUEST_NOT_PENDING: { status: 409, title: 'Connection request is no longer pending' },
  NETWORK_NOT_CONNECTED: { status: 404, title: 'Members are not connected' },
  NETWORK_MEMBER_BLOCKED: { status: 409, title: 'You blocked this member' },
  NETWORK_LIST_HIDDEN: { status: 403, title: 'This network list is not visible to you' },
  INTERNAL_ERROR: { status: 500, title: 'Internal error' },
  SERVICE_UNAVAILABLE: { status: 503, title: 'Service unavailable' },
} as const satisfies Record<string, ErrorCodeDefinition>;

export type ErrorCode = keyof typeof errorCodes;

export const errorCodeSchema = z.enum(Object.keys(errorCodes) as [ErrorCode, ...ErrorCode[]]);

export function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(errorCodes, value);
}

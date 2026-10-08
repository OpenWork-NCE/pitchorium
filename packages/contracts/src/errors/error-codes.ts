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
  ACCESS_REAUTHENTICATION_REQUIRED: { status: 403, title: 'Recent authentication required' },
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
  CONTENT_POST_NOT_FOUND: { status: 404, title: 'Publication not found' },
  CONTENT_COMMENT_NOT_FOUND: { status: 404, title: 'Comment not found' },
  CONTENT_POST_EMPTY: {
    status: 422,
    title: 'A publication needs a text, images, a document or a link',
  },
  CONTENT_MEDIA_COMBINATION: {
    status: 422,
    title: 'A publication holds up to nine images or one document, not both',
  },
  CONTENT_PUBLIC_VISIBILITY_NOT_ALLOWED: {
    status: 422,
    title: 'A public publication needs the public page of the author',
  },
  CONTENT_VISIBILITY_NOT_ALLOWED: {
    status: 422,
    title: 'This visibility is not available for this author',
  },
  CONTENT_REPOST_NOT_ALLOWED: {
    status: 422,
    title: 'This publication cannot be reposted outside of its audience',
  },
  CONTENT_PROJECT_NOT_FOUND: { status: 422, title: 'Project not found' },
  CONTENT_MENTION_NOT_ALLOWED: { status: 422, title: 'This member cannot be mentioned' },
  CONTENT_COMMENTS_DISABLED: { status: 409, title: 'Comments are disabled on this publication' },
  CONTENT_REPLY_DEPTH: { status: 422, title: 'Replies are only possible to top-level comments' },
  CONTENT_ORGANIZATION_ROLE_REQUIRED: {
    status: 403,
    title: 'Only owners and admins publish as the organization',
  },
  IMPACT_METHODOLOGY_UNAVAILABLE: { status: 409, title: 'No impact methodology is published' },
  IMPACT_METHODOLOGY_NOT_FOUND: { status: 404, title: 'Impact methodology version not found' },
  IMPACT_METHODOLOGY_NOT_DRAFT: {
    status: 409,
    title: 'A published or archived methodology version cannot change',
  },
  IMPACT_METHODOLOGY_NOT_PUBLISHED: {
    status: 409,
    title: 'Only the published methodology version can be archived',
  },
  IMPACT_METHODOLOGY_OUTDATED: {
    status: 409,
    title: 'The answers were given for a methodology version that is no longer published',
  },
  IMPACT_ANSWERS_INVALID: {
    status: 422,
    title: 'Every criterion must be answered with a level of its scale',
  },
  IMPACT_DEMO_REFUSED: {
    status: 403,
    title: 'The demonstration methodology is refused in production',
  },
  PROJECTS_NOT_FOUND: { status: 404, title: 'Project not found' },
  PROJECTS_SLUG_TAKEN: { status: 409, title: 'Project slug is already taken' },
  PROJECTS_SLUG_RESERVED: { status: 409, title: 'Project slug is reserved' },
  PROJECTS_NOT_DRAFT: { status: 409, title: 'Only a draft project allows this action' },
  PROJECTS_INVALID_TRANSITION: {
    status: 409,
    title: 'The project status does not allow this transition',
  },
  PROJECTS_NOT_PUBLISHABLE: { status: 422, title: 'Project fields are missing for publication' },
  PROJECTS_PUBLIC_DISPLAY_CONSENT_REQUIRED: {
    status: 422,
    title: 'Consent to the public display of the team is required',
  },
  PROJECTS_IMPACT_ASSESSMENT_REQUIRED: {
    status: 422,
    title: 'A self-declared impact assessment is required before publication',
  },
  PROJECTS_CURRENCY_NOT_SUPPORTED: { status: 422, title: 'Project amounts are labelled in euros' },
  PROJECTS_TIERS_INVALID: {
    status: 422,
    title: 'Tier thresholds must increase strictly and the last one equal the goal',
  },
  PROJECTS_COUNTRY_NOT_ELIGIBLE: {
    status: 422,
    title: 'Project countries must be in Africa or the Caribbean',
  },
  PROJECTS_VIDEO_URL_INVALID: {
    status: 422,
    title: 'Only YouTube and Vimeo video links are accepted',
  },
  PROJECTS_DESCRIPTION_INVALID: {
    status: 422,
    title: 'The description uses Markdown outside the allowed subset',
  },
  PROJECTS_FUNDING_LOCKED: {
    status: 409,
    title: 'Amounts are locked after the first paid contribution',
  },
  PROJECTS_ORGANIZATION_ROLE_REQUIRED: {
    status: 403,
    title: 'Only owners and admins of the organization may carry a project with it',
  },
  PROJECTS_TEAM_MEMBER_NOT_FOUND: { status: 404, title: 'Project team member not found' },
  PROJECTS_TEAM_MEMBER_EXISTS: {
    status: 409,
    title: 'The member is already in the team or invited',
  },
  PROJECTS_INVITATION_NOT_FOUND: { status: 404, title: 'Project invitation not found' },
  PROJECTS_LAST_OWNER: { status: 409, title: 'A project cannot be left without an owner' },
  PROJECTS_REWARD_NOT_FOUND: { status: 404, title: 'Reward not found' },
  PROJECTS_REWARD_INVALID: {
    status: 422,
    title: 'Reward instruments must be accepted by the project and exclude love money',
  },
  PROJECTS_REWARD_SOLD_OUT: { status: 409, title: 'Reward sold out' },
  PROJECTS_REWARD_IN_USE: { status: 409, title: 'A reward with reservations cannot be deleted' },
  PROJECTS_RESERVATION_NOT_FOUND: { status: 404, title: 'Reward reservation not found' },
  PROJECTS_UPDATE_NOT_FOUND: { status: 404, title: 'Project update not found' },
  PROJECTS_NOT_OPEN: { status: 409, title: 'The project is not published' },
  PROJECTS_CONTRIBUTION_CONFLICT: {
    status: 409,
    title: 'The contribution was already applied with other values',
  },
  PROJECTS_CONTRIBUTION_NOT_FOUND: { status: 404, title: 'Contribution not found' },
  PROJECTS_REVERSAL_INVALID: {
    status: 409,
    title: 'The reversal exceeds the amount of the contribution not yet reversed',
  },
  PAYMENTS_PROJECT_NOT_OPEN: { status: 409, title: 'The project is not open to contributions' },
  PAYMENTS_HOLDER_NOT_READY: {
    status: 409,
    title: 'The project holder cannot receive payments yet',
  },
  PAYMENTS_NO_PAYMENT_ROUTE: {
    status: 409,
    title: 'No verified payment route serves the payout country',
  },
  PAYMENTS_METHOD_NOT_AVAILABLE: { status: 422, title: 'Payment method not available' },
  PAYMENTS_CURRENCY_NOT_AVAILABLE: { status: 422, title: 'Payment currency not available' },
  PAYMENTS_INSTRUMENT_NOT_ACCEPTED: {
    status: 422,
    title: 'The project does not accept this kind of contribution',
  },
  PAYMENTS_INSTRUMENT_NOT_COLLECTIBLE: {
    status: 422,
    title: 'This instrument is never paid online',
  },
  PAYMENTS_LICENSED_PARTNER_REQUIRED: {
    status: 422,
    title: 'Equity and loans need a licensed partner',
  },
  PAYMENTS_AMOUNT_OUT_OF_RANGE: { status: 422, title: 'Amount out of the allowed range' },
  PAYMENTS_REWARD_NOT_ELIGIBLE: {
    status: 422,
    title: 'The contribution does not give access to this reward',
  },
  PAYMENTS_ANONYMOUS_NOT_ALLOWED: { status: 422, title: 'Anonymous contributions are not allowed' },
  PAYMENTS_RATE_LIMITED: { status: 429, title: 'Too many contributions started' },
  PAYMENTS_CONTRIBUTION_NOT_FOUND: { status: 404, title: 'Contribution not found' },
  PAYMENTS_INVALID_TRANSITION: {
    status: 409,
    title: 'The contribution does not allow this action in its current status',
  },
  PAYMENTS_REFUND_INVALID: { status: 409, title: 'The refund exceeds the refundable amount' },
  PAYMENTS_PROVIDER_UNAVAILABLE: { status: 502, title: 'The payment provider did not answer' },
  PAYMENTS_PAYOUT_ACCOUNT_EXISTS: { status: 409, title: 'A payout account already exists' },
  PAYMENTS_PAYOUT_ACCOUNT_NOT_FOUND: { status: 404, title: 'Payout account not found' },
  PAYMENTS_PAYOUT_COUNTRY_NOT_SUPPORTED: {
    status: 422,
    title: 'No verified payment route serves this payout country',
  },
  PAYMENTS_PAYOUT_DETAILS_REQUIRED: {
    status: 422,
    title: 'Bank details are required for this payout country',
  },
  PAYMENTS_KYC_NOT_MANUAL: { status: 409, title: 'Identity is verified by the payment provider' },
  PAYMENTS_KYC_PENDING: { status: 409, title: 'A KYC submission is already under review' },
  PAYMENTS_KYC_ALREADY_VERIFIED: { status: 409, title: 'Identity is already verified' },
  PAYMENTS_KYC_NOT_FOUND: { status: 404, title: 'KYC submission not found' },
  PAYMENTS_KYC_ALREADY_DECIDED: { status: 409, title: 'The KYC submission was already decided' },
  PAYMENTS_OFFLINE_NOT_FOUND: { status: 404, title: 'Off-platform contribution not found' },
  PAYMENTS_OFFLINE_AMOUNT_INVALID: {
    status: 422,
    title: 'Amount required for money only, in EUR, XOF or XAF',
  },
  PAYMENTS_OFFLINE_INVALID_TRANSITION: {
    status: 409,
    title: 'The off-platform contribution does not allow this action',
  },
  PAYMENTS_OFFLINE_PROOF_REQUIRED: {
    status: 409,
    title: 'A supporting document is required before validation',
  },
  PAYMENTS_DISCREPANCY_NOT_FOUND: { status: 404, title: 'Reconciliation discrepancy not found' },
  PAYMENTS_WEBHOOK_INVALID: { status: 400, title: 'Webhook signature or payload is invalid' },
  ENGAGEMENT_TIME_ENTRY_NOT_FOUND: { status: 404, title: 'Time entry not found' },
  ENGAGEMENT_BENEFICIARY_INVALID: {
    status: 422,
    title: 'The beneficiary of the time entry is invalid',
  },
  ENGAGEMENT_TIME_ENTRY_ALREADY_ANSWERED: {
    status: 409,
    title: 'The time entry was already confirmed or disputed',
  },
  MESSAGING_CONVERSATION_NOT_FOUND: { status: 404, title: 'Conversation not found' },
  MESSAGING_RECIPIENT_NOT_FOUND: { status: 404, title: 'Recipient not found' },
  MESSAGING_SELF_CONVERSATION: { status: 422, title: 'A conversation needs another member' },
  MESSAGING_RECIPIENT_NOT_ACCEPTING: {
    status: 403,
    title: 'The recipient does not accept messages from this member',
  },
  MESSAGING_REQUEST_PENDING: {
    status: 409,
    title: 'The message request waits for the recipient',
  },
  MESSAGING_REQUEST_LIMIT: {
    status: 429,
    title: 'Too many first messages out of network in the period',
  },
  MESSAGING_REQUEST_NOT_FOUND: { status: 404, title: 'Message request not found' },
  MESSAGING_CANNOT_SEND: { status: 409, title: 'Messages cannot be sent in this conversation' },
  MESSAGING_MESSAGE_EMPTY: {
    status: 422,
    title: 'A message needs a text, an attachment or a shared publication',
  },
  MESSAGING_MESSAGE_NOT_FOUND: { status: 404, title: 'Message not found' },
  MESSAGING_NOT_SENDER: { status: 403, title: 'Only the sender may change the message' },
  MESSAGING_EDIT_WINDOW_CLOSED: { status: 409, title: 'The message can no longer be edited' },
  MESSAGING_MESSAGE_DELETED: { status: 409, title: 'The message was deleted' },
  MESSAGING_CLIENT_ID_REUSED: {
    status: 409,
    title: 'The client message id was already used for another message',
  },
  MESSAGING_SHARED_POST_NOT_FOUND: { status: 404, title: 'Shared publication not found' },
  MESSAGING_NOT_A_GROUP: { status: 422, title: 'Only a group conversation can be left' },
  MESSAGING_INTRODUCTION_NOT_FOUND: { status: 404, title: 'Introduction not found' },
  MESSAGING_INTRODUCTION_INVALID: {
    status: 422,
    title: 'An introduction brings together two other distinct members',
  },
  MESSAGING_INTRODUCTION_NOT_CONNECTED: {
    status: 422,
    title: 'The introducer must be connected to both members',
  },
  MESSAGING_INTRODUCTION_PENDING: {
    status: 409,
    title: 'The same introduction is already pending',
  },
  MESSAGING_INTRODUCTION_ALREADY_ANSWERED: {
    status: 409,
    title: 'The introduction was already answered',
  },
  NOTIFICATIONS_NOT_FOUND: { status: 404, title: 'Notification not found' },
  NOTIFICATIONS_PREFERENCE_LOCKED: {
    status: 422,
    title: 'A transactional notification cannot be turned off',
  },
  NOTIFICATIONS_UNSUBSCRIBE_INVALID: { status: 400, title: 'Unsubscribe link is invalid' },
  NOTIFICATIONS_WEBHOOK_INVALID: { status: 400, title: 'Webhook signature or payload is invalid' },
  EVENTS_NOT_FOUND: { status: 404, title: 'Event not found' },
  EVENTS_SLUG_TAKEN: { status: 409, title: 'Event slug is already taken' },
  EVENTS_SLUG_RESERVED: { status: 409, title: 'Event slug is reserved' },
  EVENTS_INVALID_TRANSITION: { status: 409, title: 'The event cannot change to this status' },
  EVENTS_NOT_DRAFT: { status: 409, title: 'Only a draft event allows this action' },
  EVENTS_SCHEDULE_INVALID: { status: 422, title: 'The dates of the event are invalid' },
  EVENTS_LOCATION_REQUIRED: { status: 422, title: 'An in-person or hybrid event needs a place' },
  EVENTS_ONLINE_URL_REQUIRED: {
    status: 422,
    title: 'An online or hybrid event needs a connection link',
  },
  EVENTS_DESCRIPTION_INVALID: {
    status: 422,
    title: 'The description contains Markdown that is not allowed',
  },
  EVENTS_PUBLIC_NOT_ALLOWED: { status: 422, title: 'A public event needs a public organizer' },
  EVENTS_ORGANIZATION_ROLE_REQUIRED: {
    status: 403,
    title: 'Owner or admin of the organization required',
  },
  EVENTS_PROJECT_ROLE_REQUIRED: { status: 403, title: 'Member of the project team required' },
  EVENTS_IMAGE_INVALID: {
    status: 422,
    title: 'The image is not a ready event image of the member',
  },
  EVENTS_REGISTRATION_CLOSED: { status: 409, title: 'Registrations are closed for this event' },
  EVENTS_NOT_REGISTERED: { status: 404, title: 'No registration to this event' },
  EVENTS_CAPACITY_BELOW_REGISTERED: {
    status: 409,
    title: 'The capacity is below the registered members',
  },
  EVENTS_CALENDAR_NOT_FOUND: { status: 404, title: 'Calendar not found' },
  MISSIONS_NOT_FOUND: { status: 404, title: 'Mission not found' },
  MISSIONS_HAT_REQUIRED: { status: 403, title: 'Expert or mentor hat required' },
  MISSIONS_BENEFICIARY_REQUIRED: {
    status: 403,
    title: 'Entrepreneur facet or project team required',
  },
  MISSIONS_PROJECT_ROLE_REQUIRED: { status: 403, title: 'Member of the project team required' },
  MISSIONS_JOB_POSTING_REFUSED: {
    status: 422,
    title: 'Missions are volunteer: no job, salary or contract',
  },
  MISSIONS_HOURS_EXCEEDED: { status: 422, title: 'Too many hours for this format of mission' },
  MISSIONS_FIELDS_INVALID: {
    status: 422,
    title: 'Fields do not fit the direction or the mode of the mission',
  },
  MISSIONS_CLOSED: { status: 409, title: 'The mission is closed' },
  MISSIONS_OWN_MISSION: { status: 422, title: 'You cannot engage on your own mission' },
  MISSIONS_ENGAGEMENT_EXISTS: {
    status: 409,
    title: 'An engagement is already open on this mission',
  },
  MISSIONS_CAPACITY_REACHED: { status: 409, title: 'The mission has no capacity left' },
  MISSIONS_ENGAGEMENT_NOT_FOUND: { status: 404, title: 'Mission engagement not found' },
  MISSIONS_INVALID_TRANSITION: {
    status: 409,
    title: 'The engagement cannot change to this status',
  },
  DISCOVERY_CANDIDATE_NOT_FOUND: { status: 404, title: 'Suggestion not found' },
  TRUST_TARGET_NOT_FOUND: { status: 404, title: 'Reported content not found' },
  TRUST_SELF_REPORT: { status: 422, title: 'Own content cannot be reported' },
  TRUST_REPORT_DUPLICATE: { status: 409, title: 'Content already reported by this member' },
  TRUST_CASE_NOT_FOUND: { status: 404, title: 'Moderation case not found' },
  TRUST_CASE_RESOLVED: { status: 409, title: 'Moderation case already resolved' },
  TRUST_DECISION_NOT_APPLICABLE: { status: 422, title: 'Decision not applicable to this target' },
  TRUST_ADMIN_REQUIRED: { status: 403, title: 'Decision reserved to administrators' },
  TRUST_ASSIGNEE_NOT_MODERATOR: { status: 422, title: 'Assignee is not a moderator' },
  TRUST_DECISION_NOT_FOUND: { status: 404, title: 'Moderation decision not found' },
  TRUST_NOT_APPEALABLE: { status: 409, title: 'Decision cannot be appealed' },
  TRUST_APPEAL_EXISTS: { status: 409, title: 'Decision already appealed' },
  TRUST_APPEAL_NOT_FOUND: { status: 404, title: 'Appeal not found' },
  TRUST_APPEAL_RESOLVED: { status: 409, title: 'Appeal already resolved' },
  TRUST_SAME_MODERATOR: { status: 403, title: 'Appeal reviewed by the author of the decision' },
  TRUST_SUSPENSION_NOT_FOUND: { status: 404, title: 'Suspension not found' },
  TRUST_PROJECT_NOT_FROZEN: { status: 409, title: 'Project not frozen by this decision' },
  PRIVACY_EXPORT_RATE_LIMITED: { status: 429, title: 'An export was requested too recently' },
  PRIVACY_EXPORT_NOT_FOUND: { status: 404, title: 'Export not found' },
  PRIVACY_EXPORT_NOT_READY: { status: 409, title: 'Export not ready or expired' },
  PRIVACY_ERASURE_PENDING: { status: 409, title: 'An erasure is already scheduled' },
  PRIVACY_ERASURE_NOT_FOUND: { status: 404, title: 'No erasure to cancel' },
  PRIVACY_CAMPAIGN_IN_PROGRESS: {
    status: 409,
    title: 'A campaign of the member is collecting contributions',
  },
  PRIVACY_SOLE_OWNER: {
    status: 409,
    title: 'The member is the only owner of an organization with members',
  },
  INTERNAL_ERROR: { status: 500, title: 'Internal error' },
  SERVICE_UNAVAILABLE: { status: 503, title: 'Service unavailable' },
} as const satisfies Record<string, ErrorCodeDefinition>;

export type ErrorCode = keyof typeof errorCodes;

export const errorCodeSchema = z.enum(Object.keys(errorCodes) as [ErrorCode, ...ErrorCode[]]);

export function isErrorCode(value: string): value is ErrorCode {
  return Object.hasOwn(errorCodes, value);
}

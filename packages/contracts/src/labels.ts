import { assignableRoleSchema, prerequisiteElementSchema, roleSchema } from './access.js';
import { postVisibilitySchema, reactionTypeSchema } from './content.js';
import { timeEntryKindSchema, timeEntryStatusSchema } from './engagement.js';
import { legalDocumentSchema, signInProviderSchema } from './identity.js';
import { impactLevelSchema, impactMethodologyStatusSchema } from './impact.js';
import { mediaRejectionReasonSchema } from './media.js';
import {
  conversationBoxSchema,
  conversationKindSchema,
  introductionAnswerSchema,
  introductionStatusSchema,
  messagePolicySchema,
  requestStateSchema,
} from './messaging.js';
import {
  connectionRequestStatusSchema,
  connectionStateSchema,
  relationDegreeSchema,
} from './network.js';
import {
  emailDigestSchema,
  notificationChannelSchema,
  notificationTypeSchema,
} from './notifications.js';
import {
  invitableRoleSchema,
  invitationStatusSchema,
  organizationRoleSchema,
  verificationStatusSchema,
} from './organizations.js';
import {
  contributionKindSchema,
  contributionRequestKindSchema,
  contributionStatusSchema,
  discrepancyKindSchema,
  discrepancyStatusSchema,
  fxRateSourceSchema,
  kycReviewStatusSchema,
  kycStatusSchema,
  offlineContributionKindSchema,
  offlineContributionStatusSchema,
  paymentMethodSchema,
  paymentsUnavailableReasonSchema,
  payoutAccountStatusSchema,
  refundStatusSchema,
  rewardReservationStateSchema,
} from './payments.js';
import {
  contributorHatSchema,
  entrepreneurNeedSchema,
  fundingInstrumentSchema,
  intentionSchema,
  patronageTypeSchema,
  profileElementSchema,
  profileStrengthLevelSchema,
  structureTypeSchema,
  visibilityLevelSchema,
} from './profiles.js';
import {
  projectInterestKindSchema,
  projectStatusSchema,
  projectTeamRoleSchema,
  publicProjectStatusSchema,
  rewardInstrumentSchema,
} from './projects.js';

/** Structural view of a Zod enum: its values. */
type AnyEnum = { readonly options: readonly string[] };

/**
 * Codes the API returns and the clients display: each value of these enums has a label in the
 * `reference` namespace of @pitchorium/i18n, under `<group>.<value>`. A subset of an enum
 * (`publicProjectStatusSchema`) shares the group of the full enum. `pnpm i18n:check` fails when
 * an exported enum is in neither LABELLED_ENUMS nor TECHNICAL_ENUMS, or when a label is missing.
 */
export const LABELLED_ENUMS: Readonly<Record<string, readonly AnyEnum[]>> = {
  intentions: [intentionSchema],
  contributorHats: [contributorHatSchema],
  structureTypes: [structureTypeSchema],
  fundingInstruments: [fundingInstrumentSchema, rewardInstrumentSchema],
  patronageTypes: [patronageTypeSchema],
  entrepreneurNeeds: [entrepreneurNeedSchema],
  visibilityLevels: [visibilityLevelSchema],
  profileStrengthLevels: [profileStrengthLevelSchema],
  profileElements: [profileElementSchema],
  prerequisiteElements: [prerequisiteElementSchema],
  roles: [roleSchema, assignableRoleSchema],
  legalDocuments: [legalDocumentSchema],
  signInProviders: [signInProviderSchema],
  organizationRoles: [organizationRoleSchema, invitableRoleSchema],
  organizationInvitationStatuses: [invitationStatusSchema],
  verificationStatuses: [verificationStatusSchema],
  connectionRequestStatuses: [connectionRequestStatusSchema],
  connectionStates: [connectionStateSchema],
  relationDegrees: [relationDegreeSchema],
  reactionTypes: [reactionTypeSchema],
  postVisibilities: [postVisibilitySchema],
  mediaRejectionReasons: [mediaRejectionReasonSchema],
  projectStatuses: [projectStatusSchema, publicProjectStatusSchema],
  projectTeamRoles: [projectTeamRoleSchema],
  projectInterestKinds: [projectInterestKindSchema],
  impactLevels: [impactLevelSchema],
  impactMethodologyStatuses: [impactMethodologyStatusSchema],
  contributionKinds: [contributionKindSchema],
  contributionRequestKinds: [contributionRequestKindSchema],
  contributionStatuses: [contributionStatusSchema],
  paymentMethods: [paymentMethodSchema],
  paymentsUnavailableReasons: [paymentsUnavailableReasonSchema],
  rewardReservationStates: [rewardReservationStateSchema],
  fxRateSources: [fxRateSourceSchema],
  refundStatuses: [refundStatusSchema],
  offlineContributionKinds: [offlineContributionKindSchema],
  offlineContributionStatuses: [offlineContributionStatusSchema],
  payoutAccountStatuses: [payoutAccountStatusSchema],
  kycStatuses: [kycStatusSchema],
  kycReviewStatuses: [kycReviewStatusSchema],
  discrepancyKinds: [discrepancyKindSchema],
  discrepancyStatuses: [discrepancyStatusSchema],
  timeEntryKinds: [timeEntryKindSchema],
  timeEntryStatuses: [timeEntryStatusSchema],
  messagePolicies: [messagePolicySchema],
  conversationKinds: [conversationKindSchema],
  conversationBoxes: [conversationBoxSchema],
  messageRequestStates: [requestStateSchema],
  introductionStatuses: [introductionStatusSchema],
  introductionAnswers: [introductionAnswerSchema],
  notificationTypes: [notificationTypeSchema],
  notificationChannels: [notificationChannelSchema],
  emailDigests: [emailDigestSchema],
};

/**
 * Exported enums that are never displayed as such: error codes (labelled in the `errors`
 * namespace), action names, locales (shown by their endonym), technical states, request
 * options, and moderation states handled by the moderation tools.
 */
export const TECHNICAL_ENUMS: readonly string[] = [
  'actionSchema',
  'errorCodeSchema',
  'localeSchema',
  'connectionRequestDirectionSchema',
  'contentModerationStatusSchema',
  'languageSourceSchema',
  'linkPreviewStatusSchema',
  'mentionTargetTypeSchema',
  'mediaContentTypeSchema',
  'mediaModerationStatusSchema',
  'mediaStatusSchema',
  'mediaUsageSchema',
  'mediaUsageVisibilitySchema',
  'mediaVisibilitySchema',
  'impactAssessmentSourceSchema',
  'impactSubjectTypeSchema',
  'projectModerationStatusSchema',
  'projectSortSchema',
  'videoProviderSchema',
  'messageKindSchema',
  'messageModerationStatusSchema',
  'introductionRoleSchema',
  'notificationPrioritySchema',
  'notificationTargetTypeSchema',
];

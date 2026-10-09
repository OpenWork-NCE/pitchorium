import { z } from 'zod';
import { uuidV7Schema } from './ids.js';
import { cursorPageSchema } from './pagination.js';
import {
  BIO_MAX_LENGTH,
  countryCodeSchema,
  handleSchema,
  httpsUrlSchema,
  referenceCodeSchema,
  structureTypeSchema,
} from './profiles.js';

export const ORGANIZATION_SLUG_MIN_LENGTH = 3;
export const ORGANIZATION_SLUG_MAX_LENGTH = 60;
/** Lower-case letters, digits and single hyphens, neither leading nor trailing. */
export const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,59}$/;
export const organizationSlugSchema = z.string().regex(ORGANIZATION_SLUG_PATTERN);

/** Roles inside an organization (not platform roles). */
export const ORGANIZATION_ROLES = ['owner', 'admin', 'member'] as const;
export const organizationRoleSchema = z.enum(ORGANIZATION_ROLES);
/** Roles an invitation may grant: ownership is only transferred. */
export const invitableRoleSchema = z.enum(['admin', 'member']);

export const VERIFICATION_STATUSES = [
  'unverified',
  'pending',
  'verified',
  'rejected',
  'revoked',
] as const;
export const verificationStatusSchema = z.enum(VERIFICATION_STATUSES);

export const INVITATION_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'revoked',
  'expired',
] as const;
export const invitationStatusSchema = z.enum(INVITATION_STATUSES);

function uniqueArray<T extends z.ZodType>(item: T, min: number, max: number) {
  return z
    .array(item)
    .min(min)
    .max(max)
    .refine((values) => new Set(values).size === values.length, {
      params: { reason: 'duplicate_values' },
    });
}

const organizationFields = {
  name: z.string().trim().min(2).max(160),
  structureType: structureTypeSchema,
  description: z.string().trim().max(BIO_MAX_LENGTH).nullable(),
  countryCodes: uniqueArray(countryCodeSchema, 1, 60),
  sectorCodes: uniqueArray(referenceCodeSchema, 0, 21),
  websiteUrl: httpsUrlSchema.nullable(),
  foundedYear: z.number().int().min(1800).max(2100).nullable(),
};

export const createOrganizationRequestSchema = z.object({
  name: organizationFields.name,
  structureType: organizationFields.structureType,
  countryCodes: organizationFields.countryCodes,
  description: organizationFields.description.optional(),
  sectorCodes: organizationFields.sectorCodes.optional(),
  websiteUrl: organizationFields.websiteUrl.optional(),
  foundedYear: organizationFields.foundedYear.optional(),
});

export const updateOrganizationRequestSchema = z.object(organizationFields).partial();

export const changeOrganizationSlugRequestSchema = z.object({ slug: organizationSlugSchema });

export const organizationMemberCardSchema = z.object({
  handle: handleSchema,
  displayName: z.string(),
  headline: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: organizationRoleSchema,
});

/** Filled by the projects and payments modules; empty until then. */
export const organizationProjectRefSchema = z.object({
  projectId: z.string(),
  slug: z.string(),
  title: z.string(),
});

export const organizationSchema = z.object({
  id: uuidV7Schema,
  slug: organizationSlugSchema,
  name: z.string(),
  structureType: structureTypeSchema,
  description: z.string().nullable(),
  countryCodes: z.array(countryCodeSchema),
  sectorCodes: z.array(z.string()),
  websiteUrl: z.string().nullable(),
  foundedYear: z.number().int().nullable(),
  logoUrl: z.string().nullable(),
  logoMediaId: z.string().nullable(),
  coverUrl: z.string().nullable(),
  coverMediaId: z.string().nullable(),
  verification: z.object({
    status: verificationStatusSchema,
    /** True only for `verified`: the badge. */
    verified: z.boolean(),
    verifiedAt: z.iso.datetime().nullable(),
  }),
  /** Public view: members with a public profile page only. Member view: every member. */
  members: z.array(organizationMemberCardSchema),
  projects: z.object({
    carried: z.array(organizationProjectRefSchema),
    supported: z.array(organizationProjectRefSchema),
  }),
  /** Role of the signed-in reader, null for a visitor or a non-member. */
  viewerRole: organizationRoleSchema.nullable(),
  createdAt: z.iso.datetime(),
});

/** A page of an organization, for the sitemap: its slug and its last change. */
export const publicOrganizationEntrySchema = z.object({
  slug: organizationSlugSchema,
  updatedAt: z.iso.datetime(),
});
export const publicOrganizationEntryPageSchema = cursorPageSchema(publicOrganizationEntrySchema);

export const myOrganizationSchema = z.object({
  id: uuidV7Schema,
  slug: organizationSlugSchema,
  name: z.string(),
  logoUrl: z.string().nullable(),
  verified: z.boolean(),
  role: organizationRoleSchema,
});

export const organizationIdParamsSchema = z.object({ organizationId: uuidV7Schema });
export const organizationSlugParamsSchema = z.object({ slug: organizationSlugSchema });
/** A member of an organization by the handle of their profile: never their user id. */
export const organizationMemberParamsSchema = z.object({
  organizationId: uuidV7Schema,
  handle: handleSchema,
});
export const organizationInvitationParamsSchema = z.object({
  organizationId: uuidV7Schema,
  invitationId: uuidV7Schema,
});

export const changeMemberRoleRequestSchema = z.object({ role: organizationRoleSchema });
export const transferOwnershipRequestSchema = z.object({ handle: handleSchema });

export const createInvitationRequestSchema = z.object({
  email: z.email().max(254),
  role: invitableRoleSchema,
});

export const invitationSchema = z.object({
  id: uuidV7Schema,
  organizationId: uuidV7Schema,
  email: z.string(),
  role: invitableRoleSchema,
  status: invitationStatusSchema,
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

/** Token received by email: proves that the invitation reached its address. */
export const invitationTokenRequestSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

export const DECLARATION_MIN_LENGTH = 20;

export const createVerificationRequestSchema = z.object({
  /** Statement of the owner on the organization and on their mandate. */
  declaration: z.string().trim().min(DECLARATION_MIN_LENGTH).max(BIO_MAX_LENGTH),
  /** Must be true: the owner certifies the declaration and documents. */
  certified: z.literal(true),
  /** Supporting documents uploaded with usage verification_document (private). */
  documentMediaIds: uniqueArray(uuidV7Schema, 1, 10),
});

export const verificationSignalsSchema = z.object({
  /** Host of the website, without `www.`. */
  websiteDomain: z.string().nullable(),
  /** A member has a verified email on this domain (non-decisive signal). */
  memberEmailOnWebsiteDomain: z.boolean(),
});

export const verificationRequestSchema = z.object({
  id: uuidV7Schema,
  organization: z.object({
    id: uuidV7Schema,
    slug: organizationSlugSchema,
    name: z.string(),
    websiteUrl: z.string().nullable(),
    verificationStatus: verificationStatusSchema,
  }),
  requestedBy: uuidV7Schema,
  declaration: z.string(),
  documentMediaIds: z.array(uuidV7Schema),
  signals: verificationSignalsSchema,
  status: z.enum(['pending', 'approved', 'rejected']),
  criteriaMet: z.array(z.string()),
  decisionReason: z.string().nullable(),
  decidedBy: uuidV7Schema.nullable(),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
});

/**
 * A verification request as its organization follows it (owners and admins): its state, its
 * documents counted and the motivation of a decision, without the reviewers.
 */
export const ownVerificationRequestSchema = z.object({
  id: uuidV7Schema,
  status: z.enum(['pending', 'approved', 'rejected']),
  declaration: z.string(),
  documentCount: z.number().int().nonnegative(),
  decisionReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
});

export const ownVerificationRequestsSchema = z.object({
  items: z.array(ownVerificationRequestSchema),
});

/** What the token of an invitation received by email invites to (page of the invitation). */
export const invitationPreviewSchema = z.object({
  organization: z.object({
    slug: organizationSlugSchema,
    name: z.string(),
    logoUrl: z.string().nullable(),
    verified: z.boolean(),
  }),
  role: invitableRoleSchema,
  expiresAt: z.iso.datetime(),
});

export const verificationQueueQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
});

export const verificationQueueSchema = z.object({
  items: z.array(verificationRequestSchema),
  /** Configured criteria (ORGANIZATIONS_VERIFICATION_CRITERIA) a decision may tick. */
  criteria: z.array(z.string()),
});

export const verificationRequestParamsSchema = z.object({ requestId: uuidV7Schema });

export const REASON_MIN_LENGTH = 10;

export const verificationDecisionRequestSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  /** Motivation, shared with the owners. */
  reason: z.string().trim().min(REASON_MIN_LENGTH).max(2000),
  criteriaMet: z
    .array(z.string().regex(/^[a-z0-9_]{1,48}$/))
    .max(50)
    .default([]),
});

export const verificationRevocationRequestSchema = z.object({
  reason: z.string().trim().min(REASON_MIN_LENGTH).max(2000),
});

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
export type InvitableRole = z.infer<typeof invitableRoleSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;
export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;
export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationRequestSchema>;
export type OrganizationMemberCard = z.infer<typeof organizationMemberCardSchema>;
export type OrganizationProjectRef = z.infer<typeof organizationProjectRefSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type MyOrganization = z.infer<typeof myOrganizationSchema>;
export type PublicOrganizationEntry = z.infer<typeof publicOrganizationEntrySchema>;
export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type CreateVerificationRequest = z.infer<typeof createVerificationRequestSchema>;
export type VerificationSignals = z.infer<typeof verificationSignalsSchema>;
export type VerificationRequest = z.infer<typeof verificationRequestSchema>;
export type VerificationQueue = z.infer<typeof verificationQueueSchema>;
export type OwnVerificationRequest = z.infer<typeof ownVerificationRequestSchema>;
export type OwnVerificationRequests = z.infer<typeof ownVerificationRequestsSchema>;
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;
export type VerificationDecisionRequest = z.infer<typeof verificationDecisionRequestSchema>;

import { z } from 'zod';
import { uuidV7Schema } from './ids.js';
import { impactAssessmentSchema, impactLevelSchema } from './impact.js';
import { mediaVariantSchema } from './media.js';
import { moneySchema } from './money.js';
import { cursorPageQuerySchema, cursorPageSchema } from './pagination.js';
import {
  countryCodeSchema,
  fundingInstrumentSchema,
  handleSchema,
  httpsUrlSchema,
  memberCardSchema,
  positiveMoneySchema,
  referenceCodeSchema,
} from './profiles.js';

export const PROJECT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,79}$/;
export const projectSlugSchema = z.string().regex(PROJECT_SLUG_PATTERN);

/** Provisional limits (docs/open-questions.md). */
export const PROJECT_TITLE_MAX_LENGTH = 120;
export const PROJECT_SUMMARY_MAX_LENGTH = 300;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 20_000;
export const PROJECT_IMPACT_AREA_MAX_LENGTH = 200;
export const PROJECT_COUNTRIES_MAX = 10;
export const PROJECT_GALLERY_MAX = 20;
export const PROJECT_DOCUMENTS_MAX = 10;
export const PROJECT_TIERS_MIN = 1;
export const PROJECT_TIERS_MAX = 5;
export const PROJECT_TIER_DESCRIPTION_MAX_LENGTH = 500;
export const PROJECT_DURATION_MIN_DAYS = 30;
export const PROJECT_DURATION_MAX_DAYS = 90;
export const PROJECT_REWARD_TITLE_MAX_LENGTH = 120;
export const PROJECT_REWARD_DESCRIPTION_MAX_LENGTH = 1000;
export const PROJECT_TEAM_FUNCTION_MAX_LENGTH = 80;
export const PROJECT_UPDATE_TEXT_MAX_LENGTH = 5000;
export const PROJECT_UPDATE_MAX_IMAGES = 6;
export const PROJECT_INTEREST_MESSAGE_MAX_LENGTH = 2000;
export const PROJECT_INTEREST_MAX_DOCUMENTS = 3;

/** Lifecycle (section 11.2): brouillon, en financement, financé, clôturé. */
export const PROJECT_STATUSES = ['draft', 'funding', 'funded', 'closed'] as const;
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
/** Statuses shown in the showcase. */
export const publicProjectStatusSchema = z.enum(['funding', 'funded', 'closed']);

export const PROJECT_MODERATION_STATUSES = ['visible', 'hidden', 'removed'] as const;
export const projectModerationStatusSchema = z.enum(PROJECT_MODERATION_STATUSES);

export const PROJECT_TEAM_ROLES = ['owner', 'editor'] as const;
export const projectTeamRoleSchema = z.enum(PROJECT_TEAM_ROLES);

/** Instruments a reward may be obtained with: love money has no material reward (§11.3). */
export const REWARD_INSTRUMENTS = ['donation', 'reward_crowdfunding'] as const;
export const rewardInstrumentSchema = z.enum(REWARD_INSTRUMENTS);

/** Expressions of interest (sections 9.1 and 11.2): no payment on the platform. */
export const PROJECT_INTEREST_KINDS = ['grant', 'honor_loan', 'equity', 'general'] as const;
export const projectInterestKindSchema = z.enum(PROJECT_INTEREST_KINDS);

export const VIDEO_PROVIDERS = ['youtube', 'vimeo'] as const;
export const videoProviderSchema = z.enum(VIDEO_PROVIDERS);

export const PROJECT_SORTS = ['recent', 'ending_soon'] as const;
export const projectSortSchema = z.enum(PROJECT_SORTS);

const uniqueArray = <T extends z.ZodType>(item: T, max: number) =>
  z
    .array(item)
    .max(max)
    .refine((values) => new Set(values).size === values.length, { message: 'Duplicate values' });

/** Amounts are positive; their currency is checked by the module (EUR, ADR 0037). */
const projectFields = {
  title: z.string().trim().min(1).max(PROJECT_TITLE_MAX_LENGTH),
  summary: z.string().trim().min(1).max(PROJECT_SUMMARY_MAX_LENGTH),
  /** Restricted Markdown (projects module README). */
  description: z.string().trim().min(1).max(PROJECT_DESCRIPTION_MAX_LENGTH),
  sectorCode: referenceCodeSchema,
  impactArea: z.string().trim().min(1).max(PROJECT_IMPACT_AREA_MAX_LENGTH),
  /** In Africa (UN M49 002) or the Caribbean (029). */
  countryCodes: uniqueArray(countryCodeSchema, PROJECT_COUNTRIES_MAX).min(1),
  /** YouTube or Vimeo page or embed URL, normalized to a privacy-respecting embed. */
  videoUrl: httpsUrlSchema,
  instruments: uniqueArray(fundingInstrumentSchema, 7).min(1),
  /** « Nous ouvrons le capital »: an intention only, never an online investment (§15.5). */
  opensCapital: z.boolean(),
  goal: positiveMoneySchema,
  durationDays: z.number().int().min(PROJECT_DURATION_MIN_DAYS).max(PROJECT_DURATION_MAX_DAYS),
};

export const createProjectRequestSchema = z.object({
  title: projectFields.title,
  /** Carrying organization, where the member is owner or admin. */
  organizationId: uuidV7Schema.optional(),
  summary: projectFields.summary.optional(),
  description: projectFields.description.optional(),
  sectorCode: projectFields.sectorCode.optional(),
  impactArea: projectFields.impactArea.optional(),
  countryCodes: projectFields.countryCodes.optional(),
  videoUrl: projectFields.videoUrl.optional(),
  instruments: projectFields.instruments.optional(),
  opensCapital: projectFields.opensCapital.optional(),
  goal: projectFields.goal.optional(),
  durationDays: projectFields.durationDays.optional(),
});

/** Every field may change; null clears an optional one. Amounts lock after a contribution. */
export const updateProjectRequestSchema = z
  .object({
    title: projectFields.title,
    organizationId: uuidV7Schema.nullable(),
    summary: projectFields.summary.nullable(),
    description: projectFields.description.nullable(),
    sectorCode: projectFields.sectorCode.nullable(),
    impactArea: projectFields.impactArea.nullable(),
    countryCodes: projectFields.countryCodes,
    videoUrl: projectFields.videoUrl.nullable(),
    instruments: projectFields.instruments,
    opensCapital: projectFields.opensCapital,
    goal: projectFields.goal.nullable(),
    durationDays: projectFields.durationDays.nullable(),
  })
  .partial();

export const changeProjectSlugRequestSchema = z.object({ slug: projectSlugSchema });

export const tierRequestSchema = z.object({
  /** Cumulative threshold: strictly increasing, the last one equal to the goal. */
  threshold: positiveMoneySchema,
  /** What the funds of this tier are used for. */
  description: z.string().trim().min(1).max(PROJECT_TIER_DESCRIPTION_MAX_LENGTH),
});

export const replaceTiersRequestSchema = z.object({
  tiers: z.array(tierRequestSchema).min(PROJECT_TIERS_MIN).max(PROJECT_TIERS_MAX),
});

export const setProjectGalleryRequestSchema = z.object({
  mediaIds: uniqueArray(uuidV7Schema, PROJECT_GALLERY_MAX),
});

export const setProjectDocumentsRequestSchema = z.object({
  mediaIds: uniqueArray(uuidV7Schema, PROJECT_DOCUMENTS_MAX),
});

export const publishProjectRequestSchema = z.object({
  /**
   * Explicit consent of the owner: the project page shows publicly their name, photo and
   * headline, even when their own profile page stays private.
   */
  publicDisplayConsent: z.literal(true),
});

const rewardFields = {
  title: z.string().trim().min(1).max(PROJECT_REWARD_TITLE_MAX_LENGTH),
  description: z.string().trim().min(1).max(PROJECT_REWARD_DESCRIPTION_MAX_LENGTH),
  minAmount: positiveMoneySchema,
  instruments: uniqueArray(rewardInstrumentSchema, REWARD_INSTRUMENTS.length).min(1),
  /** Null: unlimited. */
  quantity: z.number().int().min(1).max(1_000_000).nullable(),
  estimatedDelivery: z.iso.date().nullable(),
};

export const createRewardRequestSchema = z.object({
  ...rewardFields,
  quantity: rewardFields.quantity.optional(),
  estimatedDelivery: rewardFields.estimatedDelivery.optional(),
});

export const updateRewardRequestSchema = z.object(rewardFields).partial();

export const inviteTeamMemberRequestSchema = z.object({
  handle: handleSchema,
  role: projectTeamRoleSchema,
  function: z.string().trim().min(1).max(PROJECT_TEAM_FUNCTION_MAX_LENGTH).optional(),
});

export const acceptProjectInvitationRequestSchema = z.object({
  /** The member accepts that the project page shows their name, photo and headline. */
  publicDisplayConsent: z.literal(true),
});

export const updateTeamMemberRequestSchema = z
  .object({
    role: projectTeamRoleSchema,
    function: z.string().trim().min(1).max(PROJECT_TEAM_FUNCTION_MAX_LENGTH).nullable(),
  })
  .partial();

export const createProjectUpdateRequestSchema = z.object({
  text: z.string().trim().min(1).max(PROJECT_UPDATE_TEXT_MAX_LENGTH),
  /** Ready images of usage `project_update_image`. */
  imageMediaIds: uniqueArray(uuidV7Schema, PROJECT_UPDATE_MAX_IMAGES).optional(),
});

export const editProjectUpdateRequestSchema = z.object({
  text: z.string().trim().min(1).max(PROJECT_UPDATE_TEXT_MAX_LENGTH),
});

export const expressInterestRequestSchema = z.object({
  kind: projectInterestKindSchema,
  message: z.string().trim().min(1).max(PROJECT_INTEREST_MESSAGE_MAX_LENGTH),
  /** Indicative and non-binding. */
  indicativeAmount: positiveMoneySchema.optional(),
  /** Ready PDF files of usage `project_interest_document`, read by the project team only. */
  documentMediaIds: uniqueArray(uuidV7Schema, PROJECT_INTEREST_MAX_DOCUMENTS).optional(),
});

export const projectShowcaseQuerySchema = cursorPageQuerySchema.extend({
  countryCode: countryCodeSchema.optional(),
  sectorCode: referenceCodeSchema.optional(),
  status: publicProjectStatusSchema.optional(),
  /** Minimum self-declared impact score (40+ and 70+ in section 12); ignored without methodology. */
  minImpact: z.coerce.number().int().min(0).max(100).optional(),
  featured: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  sort: projectSortSchema.default('recent'),
});

export const projectIdParamsSchema = z.object({ projectId: uuidV7Schema });
export const projectSlugParamsSchema = z.object({ slug: projectSlugSchema });
export const projectRewardParamsSchema = z.object({
  projectId: uuidV7Schema,
  rewardId: uuidV7Schema,
});
export const projectUpdateParamsSchema = z.object({
  projectId: uuidV7Schema,
  updateId: uuidV7Schema,
});
export const projectTeamMemberParamsSchema = z.object({
  projectId: uuidV7Schema,
  handle: handleSchema,
});

export const projectImageSchema = z.object({
  mediaId: uuidV7Schema,
  /** Largest variant; a presigned URL for a file that is not public. */
  url: z.string(),
  variants: z.record(z.string(), mediaVariantSchema),
});

export const projectVideoSchema = z.object({
  provider: videoProviderSchema,
  videoId: z.string(),
  /** youtube-nocookie.com, or player.vimeo.com with dnt=1. */
  embedUrl: z.string(),
});

export const projectOrganizationSchema = z.object({
  id: uuidV7Schema,
  slug: z.string(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  verified: z.boolean(),
});

/** Self-declared score shown on a card (detail on the project page). */
export const projectImpactBadgeSchema = z.object({
  selfDeclared: z.literal(true),
  score: z.number().int().min(0).max(100),
  level: impactLevelSchema,
  methodologyVersion: z.number().int().positive(),
});

export const projectFundingSchema = z.object({
  goal: moneySchema.nullable(),
  collected: moneySchema,
  /** Collected over goal, in whole percent, may exceed 100. */
  progressPercent: z.number().int().min(0),
  contributionCount: z.number().int(),
  /** Days left until the end date, null before publication; 0 on the last day and after. */
  daysLeft: z.number().int().min(0).nullable(),
  instruments: z.array(fundingInstrumentSchema),
  opensCapital: z.boolean(),
});

export const projectCardSchema = z.object({
  id: uuidV7Schema,
  slug: projectSlugSchema,
  title: z.string(),
  summary: z.string().nullable(),
  status: projectStatusSchema,
  sectorCode: z.string().nullable(),
  countryCodes: z.array(z.string()),
  coverImageUrl: z.string().nullable(),
  owner: memberCardSchema.nullable(),
  organization: projectOrganizationSchema.nullable(),
  funding: projectFundingSchema,
  impact: projectImpactBadgeSchema.nullable(),
  featured: z.boolean(),
  publishedAt: z.iso.datetime().nullable(),
  endsAt: z.iso.datetime().nullable(),
});

export const projectTierSchema = z.object({
  id: uuidV7Schema,
  position: z.number().int().min(1),
  threshold: moneySchema,
  description: z.string(),
  /** Reached by the collected amount. */
  unlocked: z.boolean(),
  /** First time it was reached. */
  unlockedAt: z.iso.datetime().nullable(),
});

export const projectRewardSchema = z.object({
  id: uuidV7Schema,
  title: z.string(),
  description: z.string(),
  minAmount: moneySchema,
  instruments: z.array(rewardInstrumentSchema),
  quantity: z.number().int().nullable(),
  /** Null when unlimited. */
  available: z.number().int().nullable(),
  soldOut: z.boolean(),
  estimatedDelivery: z.iso.date().nullable(),
});

export const projectTeamMemberSchema = z.object({
  member: memberCardSchema,
  role: projectTeamRoleSchema,
  function: z.string().nullable(),
});

export const projectUpdateSchema = z.object({
  id: uuidV7Schema,
  projectId: uuidV7Schema,
  author: memberCardSchema,
  text: z.string(),
  images: z.array(projectImageSchema),
  publishedAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
});

export const projectDocumentSchema = z.object({
  mediaId: uuidV7Schema,
  /** Read by GET /v1/media/{mediaId}/download-url. */
  pageCount: z.number().int().nullable(),
  thumbnailUrl: z.string().nullable(),
});

export const projectShareSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
});

/** Management data, for the members of the team only. */
export const projectManagementSchema = z.object({
  viewerRole: projectTeamRoleSchema,
  moderationStatus: projectModerationStatusSchema,
  durationDays: z.number().int().nullable(),
  /** Goal, tier thresholds and reward minimums are locked after the first paid contribution. */
  fundingLocked: z.boolean(),
  publicDisplayConsentAt: z.iso.datetime().nullable(),
  invitations: z.array(projectTeamMemberSchema),
  impactAssessmentRequired: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** The project page (section 11.2), as seen by a visitor, a member or the team (preview). */
export const projectSchema = projectCardSchema.extend({
  description: z.string().nullable(),
  impactArea: z.string().nullable(),
  video: projectVideoSchema.nullable(),
  gallery: z.array(projectImageSchema),
  /** Private documents: listed for signed-in members only. */
  documents: z.array(projectDocumentSchema),
  tiers: z.array(projectTierSchema),
  rewards: z.array(projectRewardSchema),
  /** Latest updates; the complete list is paginated. */
  updates: z.array(projectUpdateSchema),
  team: z.array(projectTeamMemberSchema),
  /** Self-declared assessment with its detail by criterion, null without one. */
  impactAssessment: impactAssessmentSchema.nullable(),
  share: projectShareSchema,
  /** State of the signed-in reader; null for a visitor. */
  viewer: z
    .object({
      following: z.boolean(),
      teamRole: projectTeamRoleSchema.nullable(),
    })
    .nullable(),
  management: projectManagementSchema.nullable(),
});

export const myProjectSchema = z.object({
  project: projectCardSchema,
  role: projectTeamRoleSchema,
});

export const projectInvitationSchema = z.object({
  project: projectCardSchema,
  role: projectTeamRoleSchema,
  function: z.string().nullable(),
  invitedBy: memberCardSchema.nullable(),
  invitedAt: z.iso.datetime(),
});

export const projectInterestSchema = z.object({
  id: uuidV7Schema,
  kind: projectInterestKindSchema,
  member: memberCardSchema,
  message: z.string(),
  indicativeAmount: moneySchema.nullable(),
  documents: z.array(z.object({ mediaId: uuidV7Schema })),
  createdAt: z.iso.datetime(),
});

export const projectCardPageSchema = cursorPageSchema(projectCardSchema);
export const projectUpdatePageSchema = cursorPageSchema(projectUpdateSchema);
export const projectInterestPageSchema = cursorPageSchema(projectInterestSchema);

/** A project as it appears in an item of the feed. */
export const projectRefSchema = z.object({
  id: uuidV7Schema,
  slug: projectSlugSchema,
  title: z.string(),
  coverImageUrl: z.string().nullable(),
});

export const projectUpdateFeedEntrySchema = projectUpdateSchema.extend({
  project: projectRefSchema,
});

export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type PublicProjectStatus = z.infer<typeof publicProjectStatusSchema>;
export type ProjectModerationStatus = z.infer<typeof projectModerationStatusSchema>;
export type ProjectTeamRole = z.infer<typeof projectTeamRoleSchema>;
export type RewardInstrument = z.infer<typeof rewardInstrumentSchema>;
export type ProjectInterestKind = z.infer<typeof projectInterestKindSchema>;
export type VideoProvider = z.infer<typeof videoProviderSchema>;
export type ProjectSort = z.infer<typeof projectSortSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
export type TierRequest = z.infer<typeof tierRequestSchema>;
export type CreateRewardRequest = z.infer<typeof createRewardRequestSchema>;
export type UpdateRewardRequest = z.infer<typeof updateRewardRequestSchema>;
export type InviteTeamMemberRequest = z.infer<typeof inviteTeamMemberRequestSchema>;
export type UpdateTeamMemberRequest = z.infer<typeof updateTeamMemberRequestSchema>;
export type CreateProjectUpdateRequest = z.infer<typeof createProjectUpdateRequestSchema>;
export type ExpressInterestRequest = z.infer<typeof expressInterestRequestSchema>;
export type ProjectShowcaseQuery = z.infer<typeof projectShowcaseQuerySchema>;
export type ProjectImage = z.infer<typeof projectImageSchema>;
export type ProjectVideo = z.infer<typeof projectVideoSchema>;
export type ProjectOrganization = z.infer<typeof projectOrganizationSchema>;
export type ProjectImpactBadge = z.infer<typeof projectImpactBadgeSchema>;
export type ProjectFunding = z.infer<typeof projectFundingSchema>;
export type ProjectCard = z.infer<typeof projectCardSchema>;
export type ProjectTier = z.infer<typeof projectTierSchema>;
export type ProjectReward = z.infer<typeof projectRewardSchema>;
export type ProjectTeamMember = z.infer<typeof projectTeamMemberSchema>;
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>;
export type ProjectDocument = z.infer<typeof projectDocumentSchema>;
export type ProjectManagement = z.infer<typeof projectManagementSchema>;
export type Project = z.infer<typeof projectSchema>;
export type MyProject = z.infer<typeof myProjectSchema>;
export type ProjectInvitation = z.infer<typeof projectInvitationSchema>;
export type ProjectInterest = z.infer<typeof projectInterestSchema>;
export type ProjectRef = z.infer<typeof projectRefSchema>;
export type ProjectUpdateFeedEntry = z.infer<typeof projectUpdateFeedEntrySchema>;

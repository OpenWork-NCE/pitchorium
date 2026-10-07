import { z } from 'zod';
import { currencyCodeSchema } from './money.js';

/** Onboarding intention (cahier des charges, section 7.2 step 2). Skippable, never locking. */
export const INTENTIONS = ['carry_project', 'support_projects', 'both_or_exploring'] as const;
export const intentionSchema = z.enum(INTENTIONS);

/** Contributor hats (section 5). */
export const CONTRIBUTOR_HATS = [
  'investor',
  'patron_donor',
  'mentor',
  'expert',
  'business_partner',
  'recruiter',
] as const;
export const contributorHatSchema = z.enum(CONTRIBUTOR_HATS);

/** Structure types (section 5). */
export const STRUCTURE_TYPES = [
  'individual',
  'company',
  'ngo_association',
  'foundation',
  'institution',
  'international_organization',
  'cooperative',
] as const;
export const structureTypeSchema = z.enum(STRUCTURE_TYPES);

/** Funding instruments (section 9.1). */
export const FUNDING_INSTRUMENTS = [
  'donation',
  'reward_crowdfunding',
  'love_money',
  'grant',
  'honor_loan',
  'equity',
  'convertible_bonds',
] as const;
export const fundingInstrumentSchema = z.enum(FUNDING_INSTRUMENTS);

export const PATRONAGE_TYPES = ['financial', 'in_kind', 'skills'] as const;
export const patronageTypeSchema = z.enum(PATRONAGE_TYPES);

/** Entrepreneur needs, aligned on contributor hats for matching (see NEED_TO_HATS). */
export const ENTREPRENEUR_NEEDS = [
  'funding',
  'donation',
  'mentoring',
  'expertise',
  'business_partnership',
  'recruitment',
] as const;
export const entrepreneurNeedSchema = z.enum(ENTREPRENEUR_NEEDS);

/** Provisional correspondence used by future matching; see docs/open-questions.md. */
export const NEED_TO_HATS: Readonly<
  Record<z.infer<typeof entrepreneurNeedSchema>, readonly z.infer<typeof contributorHatSchema>[]>
> = {
  funding: ['investor'],
  donation: ['patron_donor'],
  mentoring: ['mentor'],
  expertise: ['expert'],
  business_partnership: ['business_partner'],
  recruitment: ['recruiter'],
};

/** Audience of a group of profile data. */
export const VISIBILITY_LEVELS = ['public', 'members', 'private'] as const;
export const visibilityLevelSchema = z.enum(VISIBILITY_LEVELS);

export const PROFILE_STRENGTH_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
  'complete',
] as const;
export const profileStrengthLevelSchema = z.enum(PROFILE_STRENGTH_LEVELS);

export const PROFILE_ELEMENTS = [
  'avatar',
  'display_name',
  'headline',
  'location',
  'bio',
  'languages',
  'links',
  'cover',
  'intention',
  'facet',
] as const;
export const profileElementSchema = z.enum(PROFILE_ELEMENTS);

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 30;
/** Lower-case letters, digits and single hyphens, neither leading nor trailing. */
export const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,29}$/;
export const handleSchema = z.string().regex(HANDLE_PATTERN);

export const HEADLINE_MAX_LENGTH = 220;
export const BIO_MAX_LENGTH = 2600;

/** ISO 3166-1 alpha-2; existence is checked against the reference data. */
export const countryCodeSchema = z.string().regex(/^[A-Z]{2}$/);

const languageNames = new Intl.DisplayNames(['en'], { type: 'language', fallback: 'none' });

/** ISO 639-1. */
export const languageCodeSchema = z
  .string()
  .regex(/^[a-z]{2}$/)
  .refine((code) => languageNames.of(code) !== undefined, { message: 'Unknown language' });

/** Reference data codes (sectors, stages) are checked against the database. */
export const referenceCodeSchema = z.string().regex(/^[a-z0-9_]{1,48}$/);

export const httpsUrlSchema = z.url({ protocol: /^https$/ }).max(2048);

export const linkedinUrlSchema = httpsUrlSchema.refine(
  (value) => {
    const host = new URL(value).hostname;
    return host === 'linkedin.com' || host.endsWith('.linkedin.com');
  },
  { message: 'Must be a linkedin.com URL' },
);

const isoCurrency = new Set(Intl.supportedValuesOf('currency'));
const positiveMinorUnitsSchema = z.string().regex(/^[1-9]\d{0,17}$/);
const nonNegativeMinorUnitsSchema = z.string().regex(/^(0|[1-9]\d{0,17})$/);
const knownCurrencySchema = currencyCodeSchema.refine((code) => isoCurrency.has(code), {
  message: 'Unknown ISO 4217 currency',
});

export const positiveMoneySchema = z.object({
  amountMinor: positiveMinorUnitsSchema,
  currency: knownCurrencySchema,
});

/** Investment ticket range: same currency, min <= max (checked by the domain). */
export const ticketRangeSchema = z.object({
  minAmountMinor: nonNegativeMinorUnitsSchema,
  maxAmountMinor: positiveMinorUnitsSchema,
  currency: knownCurrencySchema,
});

function uniqueArray<T extends z.ZodType>(item: T, max: number) {
  return z
    .array(item)
    .max(max)
    .refine((values) => new Set(values).size === values.length, { message: 'Duplicate values' });
}

export const profileLinksSchema = z.object({
  website: httpsUrlSchema.nullable(),
  linkedin: linkedinUrlSchema.nullable(),
});

export const updateBaseProfileRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    headline: z.string().trim().max(HEADLINE_MAX_LENGTH).nullable(),
    bio: z.string().trim().max(BIO_MAX_LENGTH).nullable(),
    countryCode: countryCodeSchema.nullable(),
    city: z.string().trim().min(1).max(100).nullable(),
    languages: uniqueArray(languageCodeSchema, 20),
    links: profileLinksSchema,
  })
  .partial();

export const setIntentionRequestSchema = z.object({
  /** Null clears the intention (the step was skipped). */
  intention: intentionSchema.nullable(),
});

export const changeHandleRequestSchema = z.object({ handle: handleSchema });

export const profileVisibilitySchema = z.object({
  /** Public page reachable without an account. Disabled by default (GDPR article 25). */
  publicPageEnabled: z.boolean(),
  entrepreneurDetails: visibilityLevelSchema,
  contributorDetails: visibilityLevelSchema,
  /** Stored now, enforced by the network module. */
  networkLists: visibilityLevelSchema,
});

export const updateProfileVisibilityRequestSchema = profileVisibilitySchema.partial();

const entrepreneurFacetFields = {
  companyName: z.string().trim().min(1).max(120),
  sectorCode: referenceCodeSchema,
  stageCode: referenceCodeSchema,
  companyCountryCode: countryCodeSchema,
  companyCity: z.string().trim().min(1).max(100).nullable(),
  teamSize: z.number().int().min(1).max(1_000_000).nullable(),
  foundedYear: z.number().int().min(1900).max(2100).nullable(),
  pitch: z.string().trim().max(BIO_MAX_LENGTH).nullable(),
  needs: uniqueArray(entrepreneurNeedSchema, ENTREPRENEUR_NEEDS.length),
  soughtExpertise: uniqueArray(z.string().trim().min(1).max(80), 20),
  fundingTarget: positiveMoneySchema.nullable(),
};

/** Company name, sector, stage and company country form the minimal entrepreneur facet. */
export const createEntrepreneurFacetRequestSchema = z.object({
  companyName: entrepreneurFacetFields.companyName,
  sectorCode: entrepreneurFacetFields.sectorCode,
  stageCode: entrepreneurFacetFields.stageCode,
  companyCountryCode: entrepreneurFacetFields.companyCountryCode,
  companyCity: entrepreneurFacetFields.companyCity.optional(),
  teamSize: entrepreneurFacetFields.teamSize.optional(),
  foundedYear: entrepreneurFacetFields.foundedYear.optional(),
  pitch: entrepreneurFacetFields.pitch.optional(),
  needs: entrepreneurFacetFields.needs.optional(),
  soughtExpertise: entrepreneurFacetFields.soughtExpertise.optional(),
  fundingTarget: entrepreneurFacetFields.fundingTarget.optional(),
});

export const updateEntrepreneurFacetRequestSchema = z.object(entrepreneurFacetFields).partial();

export const entrepreneurFacetSchema = z.object(entrepreneurFacetFields);

const contributorFacetFields = {
  hats: uniqueArray(contributorHatSchema, CONTRIBUTOR_HATS.length),
  structureType: structureTypeSchema,
  /** Free text, for an organization absent from the platform. */
  organizationName: z.string().trim().min(1).max(160).nullable(),
  /** Organization of the platform the member belongs to. */
  organizationId: z.uuidv7().nullable(),
  interventionCountryCodes: uniqueArray(countryCodeSchema, 300),
  sectorCodes: uniqueArray(referenceCodeSchema, 50),
  ticket: ticketRangeSchema.nullable(),
  acceptedInstruments: uniqueArray(fundingInstrumentSchema, FUNDING_INSTRUMENTS.length),
  patronageTypes: uniqueArray(patronageTypeSchema, PATRONAGE_TYPES.length),
  mentoringAvailable: z.boolean(),
  openToExpertMissions: z.boolean(),
};

/** Hats and structure type form the minimal contributor facet. */
export const createContributorFacetRequestSchema = z.object({
  hats: contributorFacetFields.hats,
  structureType: contributorFacetFields.structureType,
  organizationName: contributorFacetFields.organizationName.optional(),
  organizationId: contributorFacetFields.organizationId.optional(),
  interventionCountryCodes: contributorFacetFields.interventionCountryCodes.optional(),
  sectorCodes: contributorFacetFields.sectorCodes.optional(),
  ticket: contributorFacetFields.ticket.optional(),
  acceptedInstruments: contributorFacetFields.acceptedInstruments.optional(),
  patronageTypes: contributorFacetFields.patronageTypes.optional(),
  mentoringAvailable: contributorFacetFields.mentoringAvailable.optional(),
  openToExpertMissions: contributorFacetFields.openToExpertMissions.optional(),
});

export const updateContributorFacetRequestSchema = z.object(contributorFacetFields).partial();

export const contributorFacetSchema = z.object(contributorFacetFields);

export const profileStrengthSchema = z.object({
  level: profileStrengthLevelSchema,
  percent: z.number().int().min(0).max(100),
  /** Missing elements, heaviest first. */
  missing: z.array(profileElementSchema),
});

const profileBaseViewFields = {
  handle: handleSchema,
  displayName: z.string(),
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  countryCode: countryCodeSchema.nullable(),
  city: z.string().nullable(),
  languages: z.array(z.string()),
  links: profileLinksSchema,
  /** Uploaded photo (largest variant), else the photo of the OAuth provider. */
  avatarUrl: z.string().nullable(),
  avatarMediaId: z.string().nullable(),
  /** Uploaded cover (largest variant). */
  coverUrl: z.string().nullable(),
  coverMediaId: z.string().nullable(),
  /** Which facets exist, even when their details are hidden from the reader. */
  facets: z.object({ entrepreneur: z.boolean(), contributor: z.boolean() }),
  /** Null when absent or hidden from the reader. */
  entrepreneur: entrepreneurFacetSchema.nullable(),
  contributor: contributorFacetSchema.nullable(),
  /** Organization linked to the contributor facet, when its details are visible. */
  contributorOrganization: z
    .object({ id: z.string(), slug: z.string(), name: z.string(), verified: z.boolean() })
    .nullable(),
};

/** Profile as seen by another member or by an anonymous visitor (privacy applied). */
export const profileViewSchema = z.object(profileBaseViewFields);

/** Profile as seen by its owner. */
export const ownProfileSchema = z.object({
  ...profileBaseViewFields,
  userId: z.string(),
  intention: intentionSchema.nullable(),
  visibility: profileVisibilitySchema,
  strength: profileStrengthSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/** How a member appears in lists of other modules (network, content): never their user id. */
export const memberCardSchema = z.object({
  handle: handleSchema,
  displayName: z.string(),
  headline: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const profileSummarySchema = z.object({
  handle: handleSchema,
  displayName: z.string(),
  headline: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  intention: intentionSchema.nullable(),
  facets: z.object({ entrepreneur: z.boolean(), contributor: z.boolean() }),
  publicPageEnabled: z.boolean(),
});

export type Intention = z.infer<typeof intentionSchema>;
export type MemberCard = z.infer<typeof memberCardSchema>;
export type ContributorHat = z.infer<typeof contributorHatSchema>;
export type StructureType = z.infer<typeof structureTypeSchema>;
export type FundingInstrument = z.infer<typeof fundingInstrumentSchema>;
export type PatronageType = z.infer<typeof patronageTypeSchema>;
export type EntrepreneurNeed = z.infer<typeof entrepreneurNeedSchema>;
export type VisibilityLevel = z.infer<typeof visibilityLevelSchema>;
export type ProfileStrengthLevel = z.infer<typeof profileStrengthLevelSchema>;
export type ProfileElement = z.infer<typeof profileElementSchema>;
export type PositiveMoney = z.infer<typeof positiveMoneySchema>;
export type TicketRange = z.infer<typeof ticketRangeSchema>;
export type ProfileLinks = z.infer<typeof profileLinksSchema>;
export type UpdateBaseProfileRequest = z.infer<typeof updateBaseProfileRequestSchema>;
export type ProfileVisibility = z.infer<typeof profileVisibilitySchema>;
export type UpdateProfileVisibilityRequest = z.infer<typeof updateProfileVisibilityRequestSchema>;
export type CreateEntrepreneurFacetRequest = z.infer<typeof createEntrepreneurFacetRequestSchema>;
export type UpdateEntrepreneurFacetRequest = z.infer<typeof updateEntrepreneurFacetRequestSchema>;
export type EntrepreneurFacet = z.infer<typeof entrepreneurFacetSchema>;
export type CreateContributorFacetRequest = z.infer<typeof createContributorFacetRequestSchema>;
export type UpdateContributorFacetRequest = z.infer<typeof updateContributorFacetRequestSchema>;
export type ContributorFacet = z.infer<typeof contributorFacetSchema>;
export type ProfileStrength = z.infer<typeof profileStrengthSchema>;
export type ProfileView = z.infer<typeof profileViewSchema>;
export type OwnProfile = z.infer<typeof ownProfileSchema>;
export type ProfileSummary = z.infer<typeof profileSummarySchema>;

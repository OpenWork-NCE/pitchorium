import { z } from 'zod';
import { timeEntryKindSchema, timeEntryStatusSchema } from './engagement.js';
import { uuidV7Schema } from './ids.js';
import { cursorPageQuerySchema, cursorPageSchema } from './pagination.js';
import {
  countryCodeSchema,
  languageCodeSchema,
  memberCardSchema,
  referenceCodeSchema,
} from './profiles.js';

/**
 * Expertise missions (§6.3, §10.1, §14): volunteer skills-based patronage, never paid, never a
 * job offer; the recruiter stays a hat, not a job board (ADR 0071).
 */
export const MISSION_TITLE_MAX_LENGTH = 120;
export const MISSION_DESCRIPTION_MAX_LENGTH = 5_000;
export const MISSION_DOMAIN_MAX_LENGTH = 80;
export const MISSION_SKILLS_MAX = 10;
export const MISSION_SECTORS_MAX = 5;
export const MISSION_COUNTRIES_MAX = 10;
export const MISSION_LANGUAGES_MAX = 5;
export const MISSION_CAPACITY_MAX = 20;
export const MISSION_MESSAGE_MAX_LENGTH = 2_000;

/**
 * Hours a packaged mission may announce (provisional, docs/open-questions.md): a session is a
 * few hours, a short mission a few days of work; more would be a job.
 */
export const MISSION_MAX_HOURS = { session: 8, short_mission: 80 } as const;

/** `offer`: an expert or mentor proposes; `request`: a project or an entrepreneur needs help. */
export const MISSION_DIRECTIONS = ['offer', 'request'] as const;
export const missionDirectionSchema = z.enum(MISSION_DIRECTIONS);

/** One-off session or short mission. */
export const MISSION_FORMATS = ['session', 'short_mission'] as const;
export const missionFormatSchema = z.enum(MISSION_FORMATS);

export const MISSION_MODES = ['remote', 'on_site'] as const;
export const missionModeSchema = z.enum(MISSION_MODES);

export const MISSION_STATUSES = ['open', 'closed'] as const;
export const missionStatusSchema = z.enum(MISSION_STATUSES);

export const MISSION_VISIBILITIES = ['members', 'public'] as const;
export const missionVisibilitySchema = z.enum(MISSION_VISIBILITIES);

export const MISSION_MODERATION_STATUSES = ['visible', 'hidden', 'removed'] as const;
export const missionModerationStatusSchema = z.enum(MISSION_MODERATION_STATUSES);

/**
 * Engagement between the expert and the beneficiary: asked (application to a request, or
 * solicitation of an offer), answered, in progress (`accepted`), then completed or canceled.
 */
export const MISSION_ENGAGEMENT_STATUSES = [
  'requested',
  'accepted',
  'declined',
  'completed',
  'canceled',
] as const;
export const missionEngagementStatusSchema = z.enum(MISSION_ENGAGEMENT_STATUSES);

const missionFields = {
  title: z.string().trim().min(1).max(MISSION_TITLE_MAX_LENGTH),
  description: z.string().trim().min(1).max(MISSION_DESCRIPTION_MAX_LENGTH),
  /** Mentoring or expertise, as in the shared time log. */
  kind: timeEntryKindSchema,
  /** Field of expertise, free text (no list in the specification). */
  domain: z.string().trim().min(1).max(MISSION_DOMAIN_MAX_LENGTH),
  sectorCodes: z.array(referenceCodeSchema).max(MISSION_SECTORS_MAX),
  format: missionFormatSchema,
  estimatedHours: z.number().int().min(1).max(MISSION_MAX_HOURS.short_mission),
  mode: missionModeSchema,
  countryCodes: z.array(countryCodeSchema).max(MISSION_COUNTRIES_MAX),
  languages: z.array(languageCodeSchema).min(1).max(MISSION_LANGUAGES_MAX),
  /** Offer: engagements in progress at once. */
  capacity: z.number().int().min(1).max(MISSION_CAPACITY_MAX),
  /** Request: skills sought. */
  skills: z.array(z.string().trim().min(1).max(60)).max(MISSION_SKILLS_MAX),
  /** Request: wished deadline (YYYY-MM-DD). */
  desiredBy: z.iso.date().nullable(),
  visibility: missionVisibilitySchema,
};

/**
 * Strict: a field that is not part of a volunteer mission (salary, rate, contract) is refused
 * rather than ignored.
 */
export const createMissionRequestSchema = z
  .object({
    direction: missionDirectionSchema,
    ...missionFields,
    sectorCodes: missionFields.sectorCodes.default([]),
    countryCodes: missionFields.countryCodes.default([]),
    capacity: missionFields.capacity.default(1),
    skills: missionFields.skills.default([]),
    desiredBy: missionFields.desiredBy.default(null),
    visibility: missionFields.visibility.default('members'),
    /** Request on behalf of a project of whose team the member is part. */
    projectId: uuidV7Schema.nullable().default(null),
  })
  .strict();

export const updateMissionRequestSchema = z.object(missionFields).partial().strict();

export const requestMissionEngagementRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(MISSION_MESSAGE_MAX_LENGTH),
    /** Solicitation of an offer for a project of whose team the member is part. */
    projectId: uuidV7Schema.nullable().default(null),
  })
  .strict();

export const answerMissionEngagementRequestSchema = z.object({
  message: z.string().trim().max(MISSION_MESSAGE_MAX_LENGTH).nullable().default(null),
});

/** Completion by the expert: the time is declared once, in the shared time log (engagement). */
export const completeMissionEngagementRequestSchema = z.object({
  minutes: z.number().int().min(1).max(1440),
  date: z.iso.date(),
  description: z.string().trim().min(1).max(1000),
});

export const missionAuthorSchema = z.object({
  member: memberCardSchema,
  project: z.object({ id: uuidV7Schema, slug: z.string(), title: z.string() }).nullable(),
});

export const missionCardSchema = z.object({
  id: uuidV7Schema,
  direction: missionDirectionSchema,
  title: z.string(),
  kind: timeEntryKindSchema,
  domain: z.string(),
  format: missionFormatSchema,
  mode: missionModeSchema,
  estimatedHours: z.number().int(),
  sectorCodes: z.array(z.string()),
  countryCodes: z.array(z.string()),
  languages: z.array(z.string()),
  status: missionStatusSchema,
  author: missionAuthorSchema,
  publishedAt: z.iso.datetime(),
});

export const missionSchema = missionCardSchema.extend({
  description: z.string(),
  skills: z.array(z.string()),
  desiredBy: z.string().nullable(),
  capacity: z.number().int(),
  /** Engagements in progress (accepted). */
  activeEngagements: z.number().int(),
  visibility: missionVisibilitySchema,
  closedAt: z.iso.datetime().nullable(),
  viewer: z
    .object({
      isAuthor: z.boolean(),
      /** The reader's own engagement on this mission, if any. */
      engagementId: uuidV7Schema.nullable(),
      canEngage: z.boolean(),
    })
    .nullable(),
  updatedAt: z.iso.datetime(),
});

export const missionEngagementSchema = z.object({
  id: uuidV7Schema,
  mission: missionCardSchema,
  status: missionEngagementStatusSchema,
  /** The member who gives their time. */
  expert: memberCardSchema,
  /** The entrepreneur helped, or the member who asked for a project. */
  beneficiary: memberCardSchema,
  project: z.object({ id: uuidV7Schema, slug: z.string(), title: z.string() }).nullable(),
  message: z.string(),
  answerMessage: z.string().nullable(),
  /** Time declared at completion, confirmed or disputed by the beneficiary (engagement). */
  timeEntry: z
    .object({ id: uuidV7Schema, minutes: z.number().int(), status: timeEntryStatusSchema })
    .nullable(),
  requestedAt: z.iso.datetime(),
  answeredAt: z.iso.datetime().nullable(),
  endedAt: z.iso.datetime().nullable(),
});

export const missionListQuerySchema = cursorPageQuerySchema.extend({
  direction: missionDirectionSchema.optional(),
  kind: timeEntryKindSchema.optional(),
  mode: missionModeSchema.optional(),
  sectorCode: referenceCodeSchema.optional(),
  countryCode: countryCodeSchema.optional(),
  language: languageCodeSchema.optional(),
});

export const MY_ENGAGEMENT_ROLES = ['expert', 'beneficiary'] as const;
export const myEngagementRoleSchema = z.enum(MY_ENGAGEMENT_ROLES);
export const myEngagementsQuerySchema = cursorPageQuerySchema.extend({
  role: myEngagementRoleSchema.optional(),
  status: missionEngagementStatusSchema.optional(),
});

export const missionIdParamsSchema = z.object({ missionId: uuidV7Schema });
export const missionEngagementIdParamsSchema = z.object({ engagementId: uuidV7Schema });

export const missionCardPageSchema = cursorPageSchema(missionCardSchema);
export const missionEngagementPageSchema = cursorPageSchema(missionEngagementSchema);

export type MissionDirection = z.infer<typeof missionDirectionSchema>;
export type MissionFormat = z.infer<typeof missionFormatSchema>;
export type MissionMode = z.infer<typeof missionModeSchema>;
export type MissionStatus = z.infer<typeof missionStatusSchema>;
export type MissionVisibility = z.infer<typeof missionVisibilitySchema>;
export type MissionModerationStatus = z.infer<typeof missionModerationStatusSchema>;
export type MissionEngagementStatus = z.infer<typeof missionEngagementStatusSchema>;
export type CreateMissionRequest = z.infer<typeof createMissionRequestSchema>;
export type UpdateMissionRequest = z.infer<typeof updateMissionRequestSchema>;
export type MissionCard = z.infer<typeof missionCardSchema>;
export type MissionView = z.infer<typeof missionSchema>;
export type MissionEngagement = z.infer<typeof missionEngagementSchema>;
export type MissionListQuery = z.infer<typeof missionListQuerySchema>;
export type MyEngagementRole = z.infer<typeof myEngagementRoleSchema>;

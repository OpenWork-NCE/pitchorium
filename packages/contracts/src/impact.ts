import { z } from 'zod';
import { uuidV7Schema } from './ids.js';

/** Key of a criterion or of a level of its answer scale. */
export const impactKeySchema = z.string().regex(/^[a-z][a-z0-9_]{0,47}$/);

/**
 * Translation key in the `reference` namespace of @pitchorium/i18n, for example
 * `impactCriteria.jobs_created.label`: the labels of a methodology are translated, not stored.
 */
export const impactLabelKeySchema = z
  .string()
  .max(128)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/);

/** Levels of a score (section 12): emerging below 40, moderate from 40 to 69, strong from 70. */
export const IMPACT_LEVELS = ['emerging', 'moderate', 'strong'] as const;
export const impactLevelSchema = z.enum(IMPACT_LEVELS);

export const IMPACT_METHODOLOGY_STATUSES = ['draft', 'published', 'archived'] as const;
export const impactMethodologyStatusSchema = z.enum(IMPACT_METHODOLOGY_STATUSES);

/** What an assessment is about: the entrepreneur facet of a member, or a project. */
export const IMPACT_SUBJECT_TYPES = ['entrepreneur_facet', 'project'] as const;
export const impactSubjectTypeSchema = z.enum(IMPACT_SUBJECT_TYPES);

/** How an assessment was made: answered by the member, or copied from another subject. */
export const IMPACT_ASSESSMENT_SOURCES = ['answered', 'prefilled'] as const;
export const impactAssessmentSourceSchema = z.enum(IMPACT_ASSESSMENT_SOURCES);

export const IMPACT_CRITERIA_MAX = 30;
export const IMPACT_SCALE_LEVELS_MAX = 10;

const uniqueBy = <T>(values: readonly T[], key: (value: T) => unknown) =>
  new Set(values.map(key)).size === values.length;

/** One answer of the scale of a criterion; the highest value is the maximum of the criterion. */
export const impactScaleLevelSchema = z.object({
  key: impactKeySchema,
  labelKey: impactLabelKeySchema,
  value: z.number().int().min(0).max(100),
});

export const impactCriterionSchema = z.object({
  key: impactKeySchema,
  labelKey: impactLabelKeySchema,
  descriptionKey: impactLabelKeySchema,
  /** Relative weight of the criterion in the score. */
  weight: z.number().int().min(1).max(100),
  scale: z
    .array(impactScaleLevelSchema)
    .min(2)
    .max(IMPACT_SCALE_LEVELS_MAX)
    .refine((levels) => uniqueBy(levels, (level) => level.key), { message: 'Duplicate keys' })
    .refine((levels) => uniqueBy(levels, (level) => level.value), { message: 'Duplicate values' })
    .refine((levels) => levels.some((level) => level.value > 0), {
      message: 'The scale needs a level above 0',
    }),
});

export const impactMethodologyDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  criteria: z
    .array(impactCriterionSchema)
    .min(1)
    .max(IMPACT_CRITERIA_MAX)
    .refine((criteria) => uniqueBy(criteria, (criterion) => criterion.key), {
      message: 'Duplicate keys',
    }),
});

export const createImpactMethodologyRequestSchema = impactMethodologyDraftSchema;
export const updateImpactMethodologyRequestSchema = impactMethodologyDraftSchema;

export const impactMethodologySchema = z.object({
  id: uuidV7Schema,
  /** Sequential number, shown next to every score. */
  version: z.number().int().positive(),
  name: z.string(),
  status: impactMethodologyStatusSchema,
  /** Fictitious methodology of the development data, never contractual. */
  demo: z.boolean(),
  criteria: z.array(impactCriterionSchema),
  createdAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
  archivedAt: z.iso.datetime().nullable(),
});

export const impactMethodologyIdParamsSchema = z.object({ methodologyId: uuidV7Schema });

export const submitImpactAssessmentRequestSchema = z.object({
  /** Version the answers were given for: it must still be the published one. */
  methodologyId: uuidV7Schema,
  /** Level key chosen for each criterion key; every criterion is answered. */
  answers: z.record(impactKeySchema, impactKeySchema),
});

export const impactMethodologyRefSchema = z.object({
  id: uuidV7Schema,
  version: z.number().int().positive(),
  name: z.string(),
  demo: z.boolean(),
});

export const impactCriterionDetailSchema = z.object({
  criterionKey: impactKeySchema,
  labelKey: impactLabelKeySchema,
  descriptionKey: impactLabelKeySchema,
  weight: z.number().int(),
  answerKey: impactKeySchema,
  answerLabelKey: impactLabelKeySchema,
  value: z.number().int(),
  maxValue: z.number().int(),
});

/**
 * A self-declared score (section 12). Every response exposing a score carries
 * `selfDeclared: true` and the methodology version; there is no certification.
 */
export const impactAssessmentSchema = z.object({
  id: uuidV7Schema,
  subjectType: impactSubjectTypeSchema,
  selfDeclared: z.literal(true),
  methodology: impactMethodologyRefSchema,
  score: z.number().int().min(0).max(100),
  level: impactLevelSchema,
  details: z.array(impactCriterionDetailSchema),
  source: impactAssessmentSourceSchema,
  /** True when a newer methodology version is published: a reassessment is proposed. */
  reassessmentSuggested: z.boolean(),
  submittedAt: z.iso.datetime(),
});

export const impactAssessmentHistorySchema = z.object({ items: z.array(impactAssessmentSchema) });

export type ImpactLevel = z.infer<typeof impactLevelSchema>;
export type ImpactMethodologyStatus = z.infer<typeof impactMethodologyStatusSchema>;
export type ImpactSubjectType = z.infer<typeof impactSubjectTypeSchema>;
export type ImpactAssessmentSource = z.infer<typeof impactAssessmentSourceSchema>;
export type ImpactScaleLevel = z.infer<typeof impactScaleLevelSchema>;
export type ImpactCriterion = z.infer<typeof impactCriterionSchema>;
export type ImpactMethodologyDraft = z.infer<typeof impactMethodologyDraftSchema>;
export type ImpactMethodology = z.infer<typeof impactMethodologySchema>;
export type ImpactMethodologyRef = z.infer<typeof impactMethodologyRefSchema>;
export type SubmitImpactAssessmentRequest = z.infer<typeof submitImpactAssessmentRequestSchema>;
export type ImpactCriterionDetail = z.infer<typeof impactCriterionDetailSchema>;
export type ImpactAssessment = z.infer<typeof impactAssessmentSchema>;

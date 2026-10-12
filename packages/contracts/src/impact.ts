import { z } from 'zod';
import { uuidV7Schema } from './ids.js';
import { localeSchema } from './locale.js';

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

/**
 * Labels written by an administrator in each language of the interface, read before the key
 * of the catalogue (ADR 0173): a methodology is authored without a deployment. A version is
 * published only once every active language has a label for each criterion, description and
 * level, stored here or in the `reference` catalogue (IMPACT_LABELS_MISSING).
 */
export const impactLabelsSchema = z.partialRecord(localeSchema, z.string().trim().min(1).max(200));
export const impactDescriptionsSchema = z.partialRecord(
  localeSchema,
  z.string().trim().min(1).max(1_000),
);

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
  labels: impactLabelsSchema.optional(),
  value: z.number().int().min(0).max(100),
});

export const impactCriterionSchema = z.object({
  key: impactKeySchema,
  labelKey: impactLabelKeySchema,
  descriptionKey: impactLabelKeySchema,
  labels: impactLabelsSchema.optional(),
  descriptions: impactDescriptionsSchema.optional(),
  /** Relative weight of the criterion in the score. */
  weight: z.number().int().min(1).max(100),
  scale: z
    .array(impactScaleLevelSchema)
    .min(2)
    .max(IMPACT_SCALE_LEVELS_MAX)
    .refine((levels) => uniqueBy(levels, (level) => level.key), {
      params: { reason: 'duplicate_keys' },
    })
    .refine((levels) => uniqueBy(levels, (level) => level.value), {
      params: { reason: 'duplicate_values' },
    })
    .refine((levels) => levels.some((level) => level.value > 0), {
      params: { reason: 'scale_without_positive_level' },
    }),
});

export const impactMethodologyDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  criteria: z
    .array(impactCriterionSchema)
    .min(1)
    .max(IMPACT_CRITERIA_MAX)
    .refine((criteria) => uniqueBy(criteria, (criterion) => criterion.key), {
      params: { reason: 'duplicate_keys' },
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

/** A label an active language still lacks: neither stored nor in the `reference` catalogue. */
export const impactMissingLabelSchema = z.object({
  criterionKey: impactKeySchema,
  /** The level of the scale, null for the criterion itself. */
  levelKey: impactKeySchema.nullable(),
  field: z.enum(['label', 'description']),
  locale: localeSchema,
});

/** A version as administrators manage it: its labels checked against the active languages. */
export const adminImpactMethodologySchema = impactMethodologySchema.extend({
  labelCoverage: z.object({
    locales: z.array(localeSchema),
    missing: z.array(impactMissingLabelSchema),
  }),
});
export const adminImpactMethodologyListSchema = z.object({
  items: z.array(adminImpactMethodologySchema),
});

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
  labels: impactLabelsSchema.optional(),
  descriptions: impactDescriptionsSchema.optional(),
  weight: z.number().int(),
  answerKey: impactKeySchema,
  answerLabelKey: impactLabelKeySchema,
  answerLabels: impactLabelsSchema.optional(),
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

/** The score some answers would give with a version, by the rules of an assessment. */
export const impactScorePreviewRequestSchema = z.object({
  answers: z.record(impactKeySchema, impactKeySchema),
});
export const impactScorePreviewSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: impactLevelSchema,
  details: z.array(impactCriterionDetailSchema),
});

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
export type ImpactLabels = z.infer<typeof impactLabelsSchema>;
export type ImpactMissingLabel = z.infer<typeof impactMissingLabelSchema>;
export type AdminImpactMethodology = z.infer<typeof adminImpactMethodologySchema>;
export type ImpactScorePreviewRequest = z.infer<typeof impactScorePreviewRequestSchema>;
export type ImpactScorePreview = z.infer<typeof impactScorePreviewSchema>;

import { z } from 'zod';
import { uuidV7Schema } from './ids.js';
import { moneySchema } from './money.js';
import { cursorPageQuerySchema, cursorPageSchema } from './pagination.js';
import { handleSchema, memberCardSchema } from './profiles.js';

/**
 * Impact dashboard (section 9.4): money really given, projects supported and hours of knowledge
 * shared. An engagement dashboard, not a bank account.
 */
export const impactDashboardSchema = z.object({
  owner: z.object({ type: z.enum(['member', 'organization']), id: uuidV7Schema }),
  /** EUR equivalent of the succeeded contributions, net of refunds and lost disputes. */
  givenThisMonth: moneySchema,
  givenTotal: moneySchema,
  projectsSupported: z.number().int(),
  minutes: z.object({
    declared: z.number().int(),
    confirmed: z.number().int(),
    disputed: z.number().int(),
  }),
  /** Start of the current month, UTC. */
  monthStart: z.iso.datetime(),
});

/** Shared time log (sections 6.3 and 9.4): mentoring and expertise. */
export const TIME_ENTRY_KINDS = ['mentoring', 'expertise'] as const;
export const timeEntryKindSchema = z.enum(TIME_ENTRY_KINDS);

export const TIME_ENTRY_STATUSES = ['declared', 'confirmed', 'disputed'] as const;
export const timeEntryStatusSchema = z.enum(TIME_ENTRY_STATUSES);

export const TIME_ENTRY_DESCRIPTION_MAX_LENGTH = 1000;
/** One entry covers at most one day. */
export const TIME_ENTRY_MAX_MINUTES = 24 * 60;

export const declareTimeEntryRequestSchema = z
  .object({
    /** A project, or an entrepreneur by handle: exactly one. */
    projectId: uuidV7Schema.optional(),
    entrepreneurHandle: handleSchema.optional(),
    kind: timeEntryKindSchema,
    minutes: z.number().int().min(1).max(TIME_ENTRY_MAX_MINUTES),
    date: z.iso.date(),
    description: z.string().trim().min(1).max(TIME_ENTRY_DESCRIPTION_MAX_LENGTH),
  })
  .refine((value) => (value.projectId === undefined) !== (value.entrepreneurHandle === undefined), {
    params: { reason: 'project_or_entrepreneur' },
    path: ['projectId'],
  });

export const timeEntrySchema = z.object({
  id: uuidV7Schema,
  contributor: memberCardSchema.nullable(),
  project: z.object({ id: uuidV7Schema, slug: z.string(), title: z.string() }).nullable(),
  entrepreneur: memberCardSchema.nullable(),
  kind: timeEntryKindSchema,
  minutes: z.number().int(),
  date: z.iso.date(),
  description: z.string(),
  status: timeEntryStatusSchema,
  respondedAt: z.iso.datetime().nullable(),
  disputeReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const timeEntryPageSchema = cursorPageSchema(timeEntrySchema);
export const timeEntryIdParamsSchema = z.object({ timeEntryId: uuidV7Schema });
export const timeEntryListQuerySchema = cursorPageQuerySchema.extend({
  status: timeEntryStatusSchema.optional(),
});
export const disputeTimeEntryRequestSchema = z.object({
  reason: z.string().trim().min(1).max(TIME_ENTRY_DESCRIPTION_MAX_LENGTH),
});

export type ImpactDashboard = z.infer<typeof impactDashboardSchema>;
export type TimeEntryKind = z.infer<typeof timeEntryKindSchema>;
export type TimeEntryStatus = z.infer<typeof timeEntryStatusSchema>;
export type DeclareTimeEntryRequest = z.infer<typeof declareTimeEntryRequestSchema>;
export type TimeEntry = z.infer<typeof timeEntrySchema>;

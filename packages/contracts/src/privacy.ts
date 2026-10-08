import { z } from 'zod';
import { uuidV7Schema } from './ids.js';
import { cursorPageQuerySchema, cursorPageSchema } from './pagination.js';

/**
 * Rights of the GDPR (§13): access and portability (articles 15 and 20) by an archive, erasure
 * (article 17) after a grace period. The archive holds one documented JSON per module and the
 * files of the member.
 */
export const EXPORT_STATUSES = ['pending', 'ready', 'failed', 'expired'] as const;
export const exportStatusSchema = z.enum(EXPORT_STATUSES);

/**
 * `scheduled` during the grace period (cancelable), `blocked` when a rule prevents it at the
 * execution (the code tells which), `running`, then `completed` or `failed` (residue found).
 */
export const ERASURE_STATUSES = [
  'scheduled',
  'canceled',
  'blocked',
  'running',
  'completed',
  'failed',
] as const;
export const erasureStatusSchema = z.enum(ERASURE_STATUSES);

export const RIGHTS_REQUEST_KINDS = ['export', 'erasure'] as const;
export const rightsRequestKindSchema = z.enum(RIGHTS_REQUEST_KINDS);

export const dataExportSchema = z.object({
  id: uuidV7Schema,
  status: exportStatusSchema,
  requestedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  /** The archive is deleted at this time; null until it is ready. */
  expiresAt: z.iso.datetime().nullable(),
  sizeBytes: z.number().int().nullable(),
});

export const dataExportDownloadSchema = z.object({
  url: z.string(),
  expiresAt: z.iso.datetime(),
});

export const erasureRequestSchema = z.object({
  id: uuidV7Schema,
  status: erasureStatusSchema,
  requestedAt: z.iso.datetime(),
  /** End of the grace period, when the worker erases the account. */
  scheduledFor: z.iso.datetime(),
  canceledAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  /** Stable code of the rule that blocks the erasure, null otherwise. */
  blockedBy: z.string().nullable(),
});

/** Explicit confirmation: the account and the data will be erased after the grace period. */
export const requestErasureRequestSchema = z.object({ confirm: z.literal(true) }).strict();

export const privacyOverviewSchema = z.object({
  exports: z.array(dataExportSchema),
  erasure: erasureRequestSchema.nullable(),
});

/** A rights request as administrators follow it, without the content of the data. */
export const rightsRequestSchema = z.object({
  id: uuidV7Schema,
  kind: rightsRequestKindSchema,
  /** Null once the account is erased (the request is pseudonymized). */
  userId: uuidV7Schema.nullable(),
  status: z.string(),
  requestedAt: z.iso.datetime(),
  /** Legal deadline of the answer: one month (article 12). */
  dueAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
  overdue: z.boolean(),
  /** Blocking rule or failure (residues found), null otherwise. */
  detail: z.string().nullable(),
});
export const rightsRequestPageSchema = cursorPageSchema(rightsRequestSchema);
export const rightsRequestQuerySchema = cursorPageQuerySchema.extend({
  kind: rightsRequestKindSchema.optional(),
});

export const exportIdParamsSchema = z.object({ exportId: uuidV7Schema });

export type ExportStatus = z.infer<typeof exportStatusSchema>;
export type ErasureStatus = z.infer<typeof erasureStatusSchema>;
export type RightsRequestKind = z.infer<typeof rightsRequestKindSchema>;
export type DataExport = z.infer<typeof dataExportSchema>;
export type DataExportDownload = z.infer<typeof dataExportDownloadSchema>;
export type ErasureRequest = z.infer<typeof erasureRequestSchema>;
export type PrivacyOverview = z.infer<typeof privacyOverviewSchema>;
export type RightsRequest = z.infer<typeof rightsRequestSchema>;
export type RightsRequestQuery = z.infer<typeof rightsRequestQuerySchema>;

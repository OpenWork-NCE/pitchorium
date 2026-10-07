import { z } from 'zod';

/** What a file is for; each usage has its own limits (media module, domain/usages.ts). */
export const MEDIA_USAGES = [
  'avatar',
  'profile_cover',
  'organization_logo',
  'organization_cover',
  'post_image',
  'post_document',
  'project_gallery',
  'project_document',
  'message_attachment',
  'verification_document',
] as const;
export const mediaUsageSchema = z.enum(MEDIA_USAGES);

/**
 * pending: upload URL issued; processing: upload confirmed, checks running; ready: usable;
 * rejected: refused by the checks; deleted: logically deleted, files purged by the worker.
 */
export const MEDIA_STATUSES = ['pending', 'processing', 'ready', 'rejected', 'deleted'] as const;
export const mediaStatusSchema = z.enum(MEDIA_STATUSES);

/** Stable reasons of a rejection. */
export const MEDIA_REJECTION_REASONS = [
  'upload_missing',
  'type_not_allowed',
  'type_mismatch',
  'size_exceeded',
  'malware_detected',
  'image_unreadable',
  'image_too_small',
  'image_too_large',
  'pdf_unreadable',
  'pdf_too_many_pages',
  'import_failed',
  'processing_failed',
] as const;
export const mediaRejectionReasonSchema = z.enum(MEDIA_REJECTION_REASONS);

export const MEDIA_VISIBILITIES = ['public', 'private'] as const;
export const mediaVisibilitySchema = z.enum(MEDIA_VISIBILITIES);

/** Set by moderation (trust module): a removed file is no longer served. */
export const MEDIA_MODERATION_STATUSES = ['none', 'flagged', 'removed'] as const;
export const mediaModerationStatusSchema = z.enum(MEDIA_MODERATION_STATUSES);

export const MEDIA_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
export const mediaContentTypeSchema = z.enum(MEDIA_CONTENT_TYPES);

export const mediaUsageLimitsSchema = z.object({
  usage: mediaUsageSchema,
  contentTypes: z.array(mediaContentTypeSchema),
  maxBytes: z.number().int().positive(),
  /** Images only. */
  minWidth: z.number().int().nullable(),
  minHeight: z.number().int().nullable(),
  maxWidth: z.number().int().nullable(),
  maxHeight: z.number().int().nullable(),
  /** PDF only. */
  maxPages: z.number().int().nullable(),
  maxPerResource: z.number().int().positive(),
  visibility: mediaVisibilitySchema,
});

export const createUploadRequestSchema = z.object({
  usage: mediaUsageSchema,
  /** Declared type: checked against the real content after the upload. */
  contentType: mediaContentTypeSchema,
  size: z.number().int().positive(),
});

export const uploadInstructionsSchema = z.object({
  method: z.literal('PUT'),
  url: z.string(),
  /** Headers to send exactly as given: type and size are part of the signature. */
  headers: z.record(z.string(), z.string()),
  expiresAt: z.iso.datetime(),
});

export const mediaVariantSchema = z.object({
  width: z.number().int(),
  height: z.number().int(),
  /** Public URL for a public file, null for a private one (use the download route). */
  webp: z.string().nullable(),
  avif: z.string().nullable(),
});

export const mediaAssetSchema = z.object({
  id: z.string(),
  usage: mediaUsageSchema,
  status: mediaStatusSchema,
  visibility: mediaVisibilitySchema,
  contentType: mediaContentTypeSchema,
  size: z.number().int(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  pageCount: z.number().int().nullable(),
  rejectionReason: mediaRejectionReasonSchema.nullable(),
  /** Image variants (WebP and AVIF) or the first page thumbnail of a PDF, by name. */
  variants: z.record(z.string(), mediaVariantSchema),
  /** Public URL of the file itself (PDF), null for an image or a private file. */
  fileUrl: z.string().nullable(),
  attached: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const uploadTicketSchema = z.object({
  media: mediaAssetSchema,
  upload: uploadInstructionsSchema,
});

export const mediaDownloadSchema = z.object({
  url: z.string(),
  expiresAt: z.iso.datetime().nullable(),
});

export const mediaIdParamsSchema = z.object({ mediaId: z.uuidv7() });

/** Body of the routes that attach a ready media to a resource (avatar, logo...). */
export const attachMediaRequestSchema = z.object({ mediaId: z.uuidv7() });

export type MediaUsage = z.infer<typeof mediaUsageSchema>;
export type MediaStatus = z.infer<typeof mediaStatusSchema>;
export type MediaRejectionReason = z.infer<typeof mediaRejectionReasonSchema>;
export type MediaVisibility = z.infer<typeof mediaVisibilitySchema>;
export type MediaModerationStatus = z.infer<typeof mediaModerationStatusSchema>;
export type MediaContentType = z.infer<typeof mediaContentTypeSchema>;
export type MediaUsageLimits = z.infer<typeof mediaUsageLimitsSchema>;
export type CreateUploadRequest = z.infer<typeof createUploadRequestSchema>;
export type UploadTicket = z.infer<typeof uploadTicketSchema>;
export type MediaVariant = z.infer<typeof mediaVariantSchema>;
export type MediaAsset = z.infer<typeof mediaAssetSchema>;
export type MediaDownload = z.infer<typeof mediaDownloadSchema>;

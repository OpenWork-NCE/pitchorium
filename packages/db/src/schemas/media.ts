import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const mediaSchema = pgSchema('media');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** Stored objects of a ready asset: image variants or the PDF and its thumbnail. */
export interface MediaVariantRecord {
  width: number;
  height: number;
  webpKey: string;
  avifKey: string | null;
}

export interface MediaFilesRecord {
  /** Key of the file itself (PDF); images keep only their variants. */
  fileKey: string | null;
  variants: Record<string, MediaVariantRecord>;
}

/**
 * Files owned by the media module; other modules only hold an asset id. The owner and the
 * attached resource are identifiers of other modules (no cross-module FK).
 */
export const mediaAssets = mediaSchema.table(
  'assets',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id').notNull(),
    usage: text('usage').notNull(),
    source: text('source').notNull(),
    status: text('status').notNull(),
    visibility: text('visibility').notNull(),
    /** Bucket the files must move to (usage following its resource); null when none is asked. */
    targetVisibility: text('target_visibility'),
    declaredContentType: text('declared_content_type').notNull(),
    declaredSize: bigint('declared_size', { mode: 'number' }).notNull(),
    contentType: text('content_type'),
    size: bigint('size', { mode: 'number' }),
    sha256: text('sha256'),
    width: integer('width'),
    height: integer('height'),
    pageCount: integer('page_count'),
    quarantineKey: text('quarantine_key').notNull(),
    files: jsonb('files').$type<MediaFilesRecord>(),
    rejectionReason: text('rejection_reason'),
    moderationStatus: text('moderation_status').notNull(),
    importUrl: text('import_url'),
    attachedResourceType: text('attached_resource_type'),
    attachedResourceId: text('attached_resource_id'),
    attachedAt: timestamptz('attached_at'),
    /** Start of the period without attachment; the orphan cleanup counts from it. */
    unattachedSince: timestamptz('unattached_since'),
    createdAt: timestamptz('created_at').notNull(),
    updatedAt: timestamptz('updated_at').notNull(),
    processedAt: timestamptz('processed_at'),
    deletedAt: timestamptz('deleted_at'),
    purgedAt: timestamptz('purged_at'),
  },
  (table) => [
    index('assets_owner_id_idx')
      .on(table.ownerId)
      .where(sql`${table.deletedAt} is null`),
    index('assets_attached_resource_idx')
      .on(table.attachedResourceType, table.attachedResourceId)
      .where(sql`${table.attachedResourceId} is not null`),
    index('assets_unattached_since_idx')
      .on(table.unattachedSince)
      .where(sql`${table.attachedResourceId} is null and ${table.deletedAt} is null`),
    index('assets_purge_pending_idx')
      .on(table.deletedAt)
      .where(sql`${table.deletedAt} is not null and ${table.purgedAt} is null`),
  ],
);

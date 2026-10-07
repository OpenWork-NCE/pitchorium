import { Injectable } from '@nestjs/common';
import type {
  MediaContentType,
  MediaModerationStatus,
  MediaRejectionReason,
  MediaStatus,
  MediaUsage,
  MediaVisibility,
} from '@pitchorium/contracts';
import { and, asc, count, eq, inArray, isNotNull, isNull, lt, ne, sql } from '@pitchorium/db/orm';
import { mediaAssets } from '@pitchorium/db/schemas/media';
import { TransactionManager } from '../../../platform/database';
import type {
  MediaAssetRecord,
  MediaResourceRef,
  MediaSource,
  StorageUsage,
} from '../domain/media-asset';
import { type MediaAssetPatch, MediaRepository } from '../application/ports';

type Row = typeof mediaAssets.$inferSelect;

function toRecord(row: Row): MediaAssetRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    usage: row.usage as MediaUsage,
    source: row.source as MediaSource,
    status: row.status as MediaStatus,
    visibility: row.visibility as MediaVisibility,
    declaredContentType: row.declaredContentType as MediaContentType,
    declaredSize: row.declaredSize,
    contentType: row.contentType as MediaContentType | null,
    size: row.size,
    sha256: row.sha256,
    width: row.width,
    height: row.height,
    pageCount: row.pageCount,
    quarantineKey: row.quarantineKey,
    files: row.files,
    rejectionReason: row.rejectionReason as MediaRejectionReason | null,
    moderationStatus: row.moderationStatus as MediaModerationStatus,
    importUrl: row.importUrl,
    attachedTo:
      row.attachedResourceType && row.attachedResourceId
        ? { type: row.attachedResourceType, id: row.attachedResourceId }
        : null,
    unattachedSince: row.unattachedSince,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

@Injectable()
export class DrizzleMediaRepository extends MediaRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async insert(asset: MediaAssetRecord): Promise<void> {
    await this.db.insert(mediaAssets).values({
      id: asset.id,
      ownerId: asset.ownerId,
      usage: asset.usage,
      source: asset.source,
      status: asset.status,
      visibility: asset.visibility,
      declaredContentType: asset.declaredContentType,
      declaredSize: asset.declaredSize,
      quarantineKey: asset.quarantineKey,
      moderationStatus: asset.moderationStatus,
      importUrl: asset.importUrl,
      unattachedSince: asset.unattachedSince,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    });
  }

  async findById(id: string): Promise<MediaAssetRecord | null> {
    const [row] = await this.db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
    return row ? toRecord(row) : null;
  }

  async findByIds(ids: readonly string[]): Promise<MediaAssetRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(mediaAssets)
      .where(inArray(mediaAssets.id, [...ids]));
    return rows.map(toRecord);
  }

  async lock(key: string): Promise<void> {
    await this.db.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }

  async usageOf(ownerId: string): Promise<StorageUsage> {
    const [row] = await this.db
      .select({
        count: count(),
        bytes: sql<string>`coalesce(sum(coalesce(${mediaAssets.size}, ${mediaAssets.declaredSize})), 0)`,
      })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.ownerId, ownerId), isNull(mediaAssets.deletedAt)));
    return { count: row?.count ?? 0, bytes: Number(row?.bytes ?? 0) };
  }

  async update(
    id: string,
    patch: MediaAssetPatch,
    now: Date,
    fromStatuses?: readonly MediaAssetRecord['status'][],
  ): Promise<boolean> {
    const { attachedTo, ...columns } = patch;
    const values: Partial<typeof mediaAssets.$inferInsert> = { ...columns, updatedAt: now };
    if (attachedTo !== undefined) {
      values.attachedResourceType = attachedTo?.type ?? null;
      values.attachedResourceId = attachedTo?.id ?? null;
    }
    const conditions = [eq(mediaAssets.id, id)];
    if (fromStatuses) conditions.push(inArray(mediaAssets.status, [...fromStatuses]));
    const updated = await this.db
      .update(mediaAssets)
      .set(values)
      .where(and(...conditions))
      .returning({ id: mediaAssets.id });
    return updated.length > 0;
  }

  async countAttached(
    resource: MediaResourceRef,
    usage: MediaUsage,
    exceptId: string,
  ): Promise<number> {
    const [row] = await this.db
      .select({ count: count() })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.attachedResourceType, resource.type),
          eq(mediaAssets.attachedResourceId, resource.id),
          eq(mediaAssets.usage, usage),
          ne(mediaAssets.id, exceptId),
          isNull(mediaAssets.deletedAt),
        ),
      );
    return row?.count ?? 0;
  }

  async orphanIds(cutoff: Date, limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ id: mediaAssets.id })
      .from(mediaAssets)
      .where(
        and(
          isNull(mediaAssets.attachedResourceId),
          isNull(mediaAssets.deletedAt),
          lt(mediaAssets.unattachedSince, cutoff),
        ),
      )
      .orderBy(asc(mediaAssets.unattachedSince))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  async unpurged(limit: number): Promise<MediaAssetRecord[]> {
    const rows = await this.db
      .select()
      .from(mediaAssets)
      .where(and(isNotNull(mediaAssets.deletedAt), isNull(mediaAssets.purgedAt)))
      .orderBy(asc(mediaAssets.deletedAt))
      .limit(limit);
    return rows.map(toRecord);
  }

  async markPurged(id: string, now: Date): Promise<void> {
    await this.db
      .update(mediaAssets)
      .set({ purgedAt: now, updatedAt: now })
      .where(eq(mediaAssets.id, id));
  }
}

import type { RightsRequestKind } from '@pitchorium/contracts';
import type { KeysetPosition } from '../../../platform/kernel';
import type { ErasureRecord, ExportRecord } from '../domain/privacy';

export interface RightsRequestRow {
  id: string;
  kind: RightsRequestKind;
  userId: string | null;
  status: string;
  requestedAt: Date;
  completedAt: Date | null;
  detail: string | null;
}

export abstract class PrivacyRepository {
  abstract insertExport(record: ExportRecord): Promise<void>;
  abstract findExport(id: string): Promise<ExportRecord | null>;
  abstract latestExport(userId: string): Promise<ExportRecord | null>;
  abstract exportsOf(userId: string, limit: number): Promise<ExportRecord[]>;
  abstract updateExport(id: string, patch: Partial<ExportRecord>): Promise<void>;
  abstract expiredExports(now: Date, limit: number): Promise<ExportRecord[]>;
  /** Exports of a member, whatever their state (erasure of the member). */
  abstract deleteExportsOf(userId: string): Promise<ExportRecord[]>;

  abstract insertErasure(record: ErasureRecord): Promise<void>;
  abstract findErasure(id: string): Promise<ErasureRecord | null>;
  abstract lockErasure(id: string): Promise<ErasureRecord | null>;
  /** Scheduled, blocked or running erasure of the member. */
  abstract openErasureOf(userId: string): Promise<ErasureRecord | null>;
  abstract latestErasureOf(userId: string): Promise<ErasureRecord | null>;
  abstract updateErasure(id: string, patch: Partial<ErasureRecord>): Promise<void>;
  /** Scheduled erasures due, and those interrupted while running. */
  abstract dueErasures(now: Date, limit: number): Promise<ErasureRecord[]>;
  /** Scheduled erasures not yet reminded whose date comes before `before`. */
  abstract erasuresToRemind(before: Date, limit: number): Promise<ErasureRecord[]>;

  /** Exports being built and erasures not finished (administration statistics). */
  abstract openRequests(): Promise<number>;
  /** Exports and erasures, newest first. */
  abstract rightsRequests(
    kind: RightsRequestKind | undefined,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<RightsRequestRow[]>;
}

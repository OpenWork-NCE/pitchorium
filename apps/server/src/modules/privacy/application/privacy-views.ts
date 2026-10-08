import type { DataExport, ErasureRequest, RightsRequest } from '@pitchorium/contracts';
import { answerDueAt, type ErasureRecord, type ExportRecord } from '../domain/privacy';
import type { RightsRequestRow } from './ports';

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

export function exportView(record: ExportRecord): DataExport {
  return {
    id: record.id,
    status: record.status,
    requestedAt: record.requestedAt.toISOString(),
    completedAt: iso(record.completedAt),
    expiresAt: iso(record.expiresAt),
    sizeBytes: record.sizeBytes,
  };
}

export function erasureView(record: ErasureRecord): ErasureRequest {
  return {
    id: record.id,
    status: record.status,
    requestedAt: record.requestedAt.toISOString(),
    scheduledFor: record.scheduledFor.toISOString(),
    canceledAt: iso(record.canceledAt),
    completedAt: iso(record.completedAt),
    blockedBy: record.blockedBy,
  };
}

const DONE = new Set(['ready', 'expired', 'completed', 'canceled']);

export function rightsRequestView(row: RightsRequestRow, now: Date): RightsRequest {
  const dueAt = answerDueAt(row.requestedAt);
  return {
    id: row.id,
    kind: row.kind,
    userId: row.userId,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    dueAt: dueAt.toISOString(),
    completedAt: iso(row.completedAt),
    overdue: !DONE.has(row.status) && dueAt < now,
    detail: row.detail,
  };
}

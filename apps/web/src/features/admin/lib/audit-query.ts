import type { AuditExportQuery } from '@pitchorium/contracts';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TEXT_FILTERS = ['actorId', 'action', 'targetType', 'targetId'] as const;

/** The filters of the audit log as the address holds them (`?from=` and `?to=` are days). */
export interface AuditFilters {
  actorId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
}

/** The filters read from the address: known parameters only, days well formed, texts bounded. */
export function auditFiltersOf(
  search: Record<string, string | string[] | undefined>,
): AuditFilters {
  const filters: AuditFilters = {};
  for (const name of TEXT_FILTERS) {
    const value = search[name];
    if (typeof value === 'string' && value.trim().length > 0) {
      filters[name] = value.trim().slice(0, name === 'action' ? 80 : 64);
    }
  }
  for (const name of ['from', 'to'] as const) {
    const value = search[name];
    if (typeof value === 'string' && DAY.test(value)) filters[name] = value;
  }
  return filters;
}

/**
 * The query of the api for these filters: a day `from` starts at midnight UTC, a day `to` is
 * included up to its last millisecond (UTC, the time of the log).
 */
export function auditQueryOf(filters: AuditFilters): AuditExportQuery {
  const { from, to, ...texts } = filters;
  return {
    ...texts,
    ...(from ? { from: `${from}T00:00:00.000Z` } : {}),
    ...(to ? { to: `${to}T23:59:59.999Z` } : {}),
  };
}

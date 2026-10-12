/** An entry of the audit log as the export writes it. */
export interface AuditRow {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  requestId: string | null;
  occurredAt: Date;
}

const HEADER = [
  'occurred_at',
  'actor_type',
  'actor_id',
  'action',
  'target_type',
  'target_id',
  'request_id',
  'metadata',
  'id',
];

/**
 * A field of RFC 4180: quoted when it holds a comma, a quote or a line break, its quotes
 * doubled; a leading `=`, `+`, `-` or `@` is prefixed with a quote so that a spreadsheet never
 * reads it as a formula.
 */
export function csvField(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** The rows of the audit log in CSV (RFC 4180, UTF-8, CRLF), the metadata as JSON. */
export function auditCsv(rows: readonly AuditRow[]): string {
  const lines = rows.map((row) =>
    [
      row.occurredAt.toISOString(),
      row.actorType,
      row.actorId ?? '',
      row.action,
      row.targetType,
      row.targetId,
      row.requestId ?? '',
      JSON.stringify(row.metadata),
      row.id,
    ]
      .map(csvField)
      .join(','),
  );
  return `${[HEADER.join(','), ...lines].join('\r\n')}\r\n`;
}

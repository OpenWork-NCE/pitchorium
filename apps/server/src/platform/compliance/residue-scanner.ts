import { Inject, Injectable } from '@nestjs/common';
import type { Database } from '@pitchorium/db';
import { sql } from '@pitchorium/db/orm';
import { DATABASE } from '../database';

/** Schemas of the application, outside the extensions and the migration journal. */
const SKIPPED_SCHEMAS = ['pg_catalog', 'information_schema', 'pg_toast', 'drizzle', 'public'];
const SCANNED_TYPES = ['uuid', 'text', 'citext', 'jsonb', 'ARRAY'];

interface ColumnRow extends Record<string, unknown> {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
}

/**
 * Searches every column of every schema of the database for the identifier and the email of
 * an erased member (GDPR, article 17): what is still found, outside the allowed tables, is a
 * residue. Generic: it knows no business module.
 */
@Injectable()
export class ResidueScanner {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /** `schema.table.column` holding the values, outside `allowed` (`schema.table`). */
  async scan(values: readonly string[], allowed: readonly string[]): Promise<string[]> {
    const needles = values.filter((value) => value.length > 0);
    if (needles.length === 0) return [];
    const columns = await this.db.execute<ColumnRow>(sql`
      select table_schema, table_name, column_name, data_type
      from information_schema.columns
      where table_schema <> all(${sql.raw(`array[${SKIPPED_SCHEMAS.map((name) => `'${name}'`).join(',')}]`)})
        and data_type = any(${sql.raw(`array[${SCANNED_TYPES.map((name) => `'${name}'`).join(',')}]`)})
      order by table_schema, table_name, column_name`);
    const found: string[] = [];
    for (const column of columns.rows) {
      const table = `${column.table_schema}.${column.table_name}`;
      if (allowed.includes(table)) continue;
      const ref = sql.raw(`"${column.table_schema}"."${column.table_name}"`);
      const name = sql.raw(`"${column.column_name}"`);
      const text = sql`${name}::text`;
      const matches = needles.map(
        (needle) => sql`strpos(lower(${text}), ${needle.toLowerCase()}) > 0`,
      );
      const result = await this.db.execute<{ found: boolean }>(
        sql`select exists (select 1 from ${ref} where ${sql.join(matches, sql` or `)}) as found`,
      );
      if (result.rows[0]?.found) found.push(`${table}.${column.column_name}`);
    }
    return found;
  }
}

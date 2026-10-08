import { sql } from '@pitchorium/db/orm';
import type { Executor } from '../database';

/** A column holding member identifiers, as `schema.table` and its column. */
export interface IdentifierColumn {
  table: string;
  column: string;
  /** `uuid` by default; arrays, texts and JSON documents are rewritten in place. */
  kind?: 'uuid' | 'uuid[]' | 'text' | 'jsonb';
}

const IDENTIFIER = /^[a-z_]+(\.[a-z_]+)?$/;

function identifier(name: string): ReturnType<typeof sql.raw> {
  // Static names written by the modules, never user input: checked anyway.
  if (!IDENTIFIER.test(name)) throw new Error(`Invalid SQL identifier ${name}`);
  return sql.raw(name);
}

/**
 * Pseudonymization: replaces an identifier (or an email) by another value in the given columns
 * of the caller's own tables, inside the current transaction. Idempotent: once replaced, the
 * value is no longer found.
 */
export async function replaceIdentifier(
  db: Executor,
  columns: readonly IdentifierColumn[],
  from: string,
  to: string,
): Promise<void> {
  for (const ref of columns) {
    const table = identifier(ref.table);
    const column = identifier(ref.column);
    switch (ref.kind ?? 'uuid') {
      case 'uuid':
        await db.execute(
          sql`update ${table} set ${column} = ${to}::uuid where ${column} = ${from}::uuid`,
        );
        break;
      case 'uuid[]':
        await db.execute(
          sql`update ${table} set ${column} = array_replace(${column}, ${from}::uuid, ${to}::uuid) where ${from}::uuid = any(${column})`,
        );
        break;
      case 'text':
        await db.execute(
          sql`update ${table} set ${column} = replace(${column}, ${from}, ${to}) where strpos(${column}, ${from}) > 0`,
        );
        break;
      case 'jsonb':
        await db.execute(
          sql`update ${table} set ${column} = replace(${column}::text, ${from}, ${to})::jsonb where strpos(${column}::text, ${from}) > 0`,
        );
        break;
    }
  }
}

/** Value written in place of an erased email or text. */
export const ERASED = '[erased]';

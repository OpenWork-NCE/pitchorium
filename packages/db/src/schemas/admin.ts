import { boolean, index, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const adminSchema = pgSchema('admin');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * History of the changes of the feature flags by the administrators, with the reference of the
 * legal validation required to enable a funding flag (`funding.equity`, `funding.loans`).
 */
export const adminFlagChanges = adminSchema.table(
  'flag_changes',
  {
    id: uuid('id').primaryKey(),
    key: text('key').notNull(),
    enabled: boolean('enabled').notNull(),
    legalReference: text('legal_reference'),
    changedBy: uuid('changed_by').notNull(),
    changedAt: timestamptz('changed_at').notNull(),
  },
  (table) => [index('flag_changes_key_idx').on(table.key, table.changedAt)],
);

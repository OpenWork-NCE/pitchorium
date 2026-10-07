import { index, pgSchema, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const accessSchema = pgSchema('access');

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** Platform roles beyond the implicit `member` role. No foreign key across modules (ADR 0002). */
export const accessRoleAssignments = accessSchema.table(
  'role_assignments',
  {
    userId: uuid('user_id').notNull(),
    role: text('role').notNull(),
    grantedAt: timestamptz('granted_at').notNull(),
    // Null when granted by the command line.
    grantedBy: uuid('granted_by'),
  },
  (table) => [
    primaryKey({ name: 'role_assignments_pk', columns: [table.userId, table.role] }),
    index('role_assignments_role_idx').on(table.role),
  ],
);

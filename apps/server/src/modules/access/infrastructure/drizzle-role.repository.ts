import { Injectable } from '@nestjs/common';
import { type AssignableRole, assignableRoleSchema } from '@pitchorium/contracts';
import { and, count, eq } from '@pitchorium/db/orm';
import { accessRoleAssignments } from '@pitchorium/db/schemas/access';
import { TransactionManager } from '../../../platform/database';
import { RoleRepository, type StoredRoleAssignment } from '../application/ports';

@Injectable()
export class DrizzleRoleRepository extends RoleRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  async assignments(userId: string): Promise<StoredRoleAssignment[]> {
    const rows = await this.transactions.executor
      .select()
      .from(accessRoleAssignments)
      .where(eq(accessRoleAssignments.userId, userId))
      .orderBy(accessRoleAssignments.role);
    // A role removed from the code base is ignored rather than granted.
    return rows.flatMap((row) => {
      const role = assignableRoleSchema.safeParse(row.role);
      return role.success
        ? [{ role: role.data, grantedAt: row.grantedAt, grantedBy: row.grantedBy }]
        : [];
    });
  }

  async grant(userId: string, assignment: StoredRoleAssignment): Promise<boolean> {
    const inserted = await this.transactions.executor
      .insert(accessRoleAssignments)
      .values({ userId, ...assignment })
      .onConflictDoNothing()
      .returning({ userId: accessRoleAssignments.userId });
    return inserted.length > 0;
  }

  async revoke(userId: string, role: AssignableRole): Promise<boolean> {
    const deleted = await this.transactions.executor
      .delete(accessRoleAssignments)
      .where(and(eq(accessRoleAssignments.userId, userId), eq(accessRoleAssignments.role, role)))
      .returning({ userId: accessRoleAssignments.userId });
    return deleted.length > 0;
  }

  async countHolders(role: AssignableRole): Promise<number> {
    const [row] = await this.transactions.executor
      .select({ value: count() })
      .from(accessRoleAssignments)
      .where(eq(accessRoleAssignments.role, role));
    return row?.value ?? 0;
  }
}

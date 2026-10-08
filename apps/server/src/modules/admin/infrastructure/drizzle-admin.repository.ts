import { Injectable } from '@nestjs/common';
import { asc, desc, eq, isNotNull } from '@pitchorium/db/orm';
import { adminFlagChanges } from '@pitchorium/db/schemas/admin';
import { TransactionManager } from '../../../platform/database';
import { AdminRepository, type FlagChangeRecord } from '../application/ports';

@Injectable()
export class DrizzleAdminRepository extends AdminRepository {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  private get db() {
    return this.transactions.executor;
  }

  async insertFlagChange(record: FlagChangeRecord): Promise<void> {
    await this.db.insert(adminFlagChanges).values(record);
  }

  async legalReferences(): Promise<Map<string, string>> {
    const rows = await this.db
      .select({ key: adminFlagChanges.key, reference: adminFlagChanges.legalReference })
      .from(adminFlagChanges)
      .where(isNotNull(adminFlagChanges.legalReference))
      .orderBy(asc(adminFlagChanges.changedAt));
    return new Map(rows.map((row) => [row.key, row.reference ?? '']));
  }

  flagChangesBy(userId: string): Promise<FlagChangeRecord[]> {
    return this.db
      .select()
      .from(adminFlagChanges)
      .where(eq(adminFlagChanges.changedBy, userId))
      .orderBy(desc(adminFlagChanges.changedAt));
  }
}

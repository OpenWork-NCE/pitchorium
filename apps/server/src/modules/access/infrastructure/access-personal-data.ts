import { Injectable, type OnModuleInit } from '@nestjs/common';
import { eq } from '@pitchorium/db/orm';
import { accessRoleAssignments } from '@pitchorium/db/schemas/access';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';

/** Personal data of access: the platform roles of the member. */
@Injectable()
export class AccessPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly transactions: TransactionManager,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'access',
      description: 'Your platform roles (moderator, administrator) and when they were granted.',
      order: ERASURE_ORDER.activity,
      exporter: {
        export: async (userId) => ({
          data: {
            roles: await this.db
              .select({
                role: accessRoleAssignments.role,
                grantedAt: accessRoleAssignments.grantedAt,
              })
              .from(accessRoleAssignments)
              .where(eq(accessRoleAssignments.userId, userId)),
          },
        }),
      },
      eraser: {
        erase: async ({ userId, pseudonym }) => {
          await this.db
            .delete(accessRoleAssignments)
            .where(eq(accessRoleAssignments.userId, userId));
          await replaceIdentifier(
            this.db,
            [{ table: 'access.role_assignments', column: 'granted_by' }],
            userId,
            pseudonym,
          );
        },
      },
    });
  }
}

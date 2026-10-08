import { Injectable, type OnModuleInit } from '@nestjs/common';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';
import { AdminRepository } from '../application/ports';

/** Personal data of admin: the changes of feature flags an administrator made, kept as evidence. */
@Injectable()
export class AdminPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly admin: AdminRepository,
    private readonly transactions: TransactionManager,
  ) {}

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'admin',
      description: 'The changes of settings (feature flags) you made as an administrator.',
      order: ERASURE_ORDER.activity,
      exporter: {
        export: async (userId) => ({
          data: { flagChanges: await this.admin.flagChangesBy(userId) },
        }),
      },
      eraser: {
        erase: ({ userId, pseudonym }) =>
          replaceIdentifier(
            this.transactions.executor,
            [{ table: 'admin.flag_changes', column: 'changed_by' }],
            userId,
            pseudonym,
          ),
      },
    });
  }
}

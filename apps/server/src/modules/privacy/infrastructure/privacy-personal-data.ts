import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ObjectStorage } from '../../../platform/storage';
import { ERASURE_ORDER, PersonalDataRegistry } from '../application/personal-data';
import { PrivacyRepository } from '../application/ports';

/**
 * Personal data of the privacy module itself: the exports of the member (their archives are
 * deleted at the erasure). The erasure request is kept until it completes, then forgets them.
 */
@Injectable()
export class PrivacyPersonalData implements OnModuleInit {
  constructor(
    private readonly registry: PersonalDataRegistry,
    private readonly privacy: PrivacyRepository,
    private readonly storage: ObjectStorage,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      module: 'privacy',
      description: 'Your requests of an export of your data, with their dates and states.',
      order: ERASURE_ORDER.privacy,
      exporter: {
        export: async (userId) => ({
          data: {
            exports: (await this.privacy.exportsOf(userId, 100)).map((item) => ({
              id: item.id,
              status: item.status,
              requestedAt: item.requestedAt,
              completedAt: item.completedAt,
            })),
          },
        }),
      },
      eraser: {
        erase: async ({ userId }) => {
          const deleted = await this.privacy.deleteExportsOf(userId);
          const keys = deleted.flatMap((item) => (item.storageKey ? [item.storageKey] : []));
          if (keys.length > 0) await this.storage.deleteObjects('private', keys);
        },
      },
    });
  }
}

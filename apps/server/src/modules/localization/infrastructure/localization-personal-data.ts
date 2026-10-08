import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ERASURE_ORDER, PrivacyFacade } from '../../privacy';
import { LocalizationRepository } from '../application/ports';

/**
 * Personal data of localization: the characters a member had translated per day, and the
 * cached translation of their profile (key: their identifier). Translations of other contents
 * hold no member identifier and expire after LOCALIZATION_CACHE_TTL_DAYS.
 */
@Injectable()
export class LocalizationPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly localization: LocalizationRepository,
  ) {}

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'localization',
      description: 'The number of characters you had machine translated, per day.',
      order: ERASURE_ORDER.activity,
      exporter: {
        export: async (userId) => ({ data: { usage: await this.localization.usageOf(userId) } }),
      },
      eraser: {
        erase: async ({ userId }) => {
          await this.localization.deleteUsageOf(userId);
          await this.localization.deleteTranslations('profile', userId);
        },
      },
    });
  }
}

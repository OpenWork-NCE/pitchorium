import { Inject, Injectable } from '@nestjs/common';
import {
  type Locale,
  LOCALES,
  type LocaleStatus,
  type TranslationUsage,
} from '@pitchorium/contracts';
import { catalogCompleteness, localeManifest } from '@pitchorium/i18n';
import { AuditService } from '../../../platform/audit';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { FeatureFlagsService } from '../../../platform/feature-flags';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { LocaleDisabled, LocaleEnabled } from '../domain/localization-events';
import { localeActivatable } from '../domain/translation-rules';
import { LocalizationEventsRecorder } from './localization-events.recorder';
import { LocalizationRepository } from './ports';

/**
 * Interface locales (§4, §8.3): a locale is enabled only with a complete catalogue and an
 * approved human review in the manifest (reviewer and date); otherwise
 * LOCALIZATION_LOCALE_NOT_READY. Changes are audited and announced.
 */
@Injectable()
export class LocalesService {
  constructor(
    private readonly flags: FeatureFlagsService,
    private readonly localization: LocalizationRepository,
    private readonly events: LocalizationEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  async statuses(): Promise<LocaleStatus[]> {
    const enabled = await this.flags.all();
    return LOCALES.map((locale) => this.status(locale, enabled.get(`locale.${locale}`) ?? false));
  }

  status(locale: Locale, enabled: boolean): LocaleStatus {
    const catalog = catalogCompleteness(locale);
    const review = localeManifest.locales[locale] ?? {
      status: 'empty',
      reviewedBy: null,
      reviewedAt: null,
    };
    return {
      locale,
      enabled,
      catalog: {
        total: catalog.total,
        missing: catalog.missing.length,
        complete: catalog.complete,
      },
      review: {
        status: review.status,
        reviewedBy: review.reviewedBy,
        reviewedAt: review.reviewedAt,
      },
      activatable: localeActivatable({ complete: catalog.complete, ...review }),
    };
  }

  /** Inside the transaction of the caller (administration of the flags). */
  async setEnabled(locale: Locale, enabled: boolean, actorId: string): Promise<LocaleStatus> {
    const status = this.status(locale, enabled);
    if (enabled && !status.activatable) {
      throw new DomainError('LOCALIZATION_LOCALE_NOT_READY', 'Locale incomplete or not reviewed');
    }
    await this.transactions.run(async () => {
      await this.flags.set(`locale.${locale}`, enabled);
      const payload = { locale, by: actorId };
      if (enabled) await this.events.record(LocaleEnabled, this.ids.next(), payload);
      else await this.events.record(LocaleDisabled, this.ids.next(), payload);
      await this.audit.record({
        actor: { type: 'user', id: actorId },
        action: enabled ? 'localization.locale-enabled' : 'localization.locale-disabled',
        target: { type: 'locale', id: locale },
      });
    });
    return status;
  }

  async usage(): Promise<TranslationUsage> {
    const month = this.clock.now().toISOString().slice(0, 7);
    return {
      month,
      characters: (await this.localization.monthUsage(month)).characters,
      monthlyCap: this.config.localization.monthlyCharactersCap,
      memberDailyLimit: this.config.localization.memberDailyCharacters,
      providers: this.config.localization.providers,
    };
  }
}

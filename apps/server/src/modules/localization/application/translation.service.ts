import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TranslateRequest, Translation } from '@pitchorium/contracts';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { FeatureFlagsService } from '../../../platform/feature-flags';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { Metrics } from '../../../platform/observability';
import { glossaryApplies, supports } from '../domain/provider-languages';
import { TranslationRequested } from '../domain/localization-events';
import { budgetRefusal, charactersOf, crossesWarning } from '../domain/translation-rules';
import { LocalizationEventsRecorder } from './localization-events.recorder';
import {
  type CachedTranslation,
  LocalizationRepository,
  type ProviderResult,
  TranslationProviders,
} from './ports';
import { TranslatableSourcesRegistry } from './translatable-sources.registry';

const NOTICE = 'common.machineTranslation' as const;

/**
 * Translation on demand of a content for a member (§8.3): only on their action, never silent
 * (`machineTranslated`, provider, notice), cached by the fingerprint of the original and the
 * target locale, within the limit of the member and the monthly cap of the platform.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private readonly localization: LocalizationRepository,
    private readonly sources: TranslatableSourcesRegistry,
    private readonly providers: TranslationProviders,
    private readonly flags: FeatureFlagsService,
    private readonly events: LocalizationEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly metrics: Metrics,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  async translate(userId: string, request: TranslateRequest): Promise<Translation> {
    const target = request.targetLocale;
    if (!(await this.flags.isEnabled(`locale.${target}`))) {
      throw new DomainError('LOCALIZATION_LOCALE_NOT_ACTIVE', 'Target locale not active');
    }
    const content = await this.sources.get(request.sourceType)?.read(request.sourceId, userId);
    if (!content || Object.keys(content.fields).length === 0) {
      throw new DomainError('LOCALIZATION_SOURCE_NOT_FOUND', 'Content to translate not found');
    }
    if (content.language === target) {
      throw new DomainError('LOCALIZATION_ALREADY_IN_LANGUAGE', 'Content already in the language');
    }
    const view = (cached: CachedTranslation, fromCache: boolean): Translation => ({
      sourceType: request.sourceType,
      sourceId: request.sourceId,
      targetLocale: target,
      sourceLanguage: cached.sourceLanguage,
      fields: cached.fields,
      machineTranslated: true,
      provider: cached.provider,
      notice: NOTICE,
      cached: fromCache,
    });
    const now = this.clock.now();
    const hash = fingerprint(content.fields, content.language);
    const cached = await this.localization.findTranslation(request.sourceType, content.key, target);
    if (cached && cached.contentHash === hash && cached.expiresAt > now) {
      await this.transactions.run(() =>
        this.events.record(TranslationRequested, this.ids.next(), {
          sourceType: request.sourceType,
          targetLocale: target,
          provider: cached.provider,
          characters: 0,
          cached: true,
        }),
      );
      return view(cached, true);
    }

    const characters = charactersOf(content.fields);
    const day = now.toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const [memberToday, monthly] = await Promise.all([
      this.localization.memberUsage(userId, day),
      this.localization.monthUsage(month),
    ]);
    const refusal = budgetRefusal(
      {
        memberToday,
        memberDailyLimit: this.config.localization.memberDailyCharacters,
        month: monthly.characters,
        monthlyCap: this.config.localization.monthlyCharactersCap,
      },
      characters,
    );
    if (refusal) {
      this.metrics.increment('pitchorium.localization.refused', { code: refusal.code });
      throw refusal;
    }

    const glossary = await this.localization.glossary();
    const keys = Object.keys(content.fields);
    let result: { provider: CachedTranslation['provider']; output: ProviderResult } | null = null;
    for (const provider of this.providers.list()) {
      if (!supports(provider.id, content.language, target)) continue;
      try {
        const output = await provider.translate({
          texts: keys.map((key) => content.fields[key] ?? ''),
          sourceLanguage: content.language,
          target,
          glossary: glossaryApplies(provider.id, content.language, target)
            ? glossary.map((term) => ({ fr: term.fr, en: term.en }))
            : [],
        });
        result = { provider: provider.id, output };
        break;
      } catch (error) {
        this.logger.warn(`Translation by ${provider.id} failed: ${String(error)}`);
        this.metrics.increment('pitchorium.localization.provider.failed', {
          provider: provider.id,
        });
      }
    }
    if (!result) throw new DomainError('LOCALIZATION_UNAVAILABLE', 'No translation provider');
    const sourceLanguage = content.language ?? result.output.detectedLanguage;
    if (sourceLanguage === target) {
      throw new DomainError('LOCALIZATION_ALREADY_IN_LANGUAGE', 'Content already in the language');
    }
    const translation: CachedTranslation = {
      sourceType: request.sourceType,
      sourceKey: content.key,
      targetLocale: target,
      contentHash: hash,
      sourceLanguage,
      provider: result.provider,
      fields: Object.fromEntries(keys.map((key, index) => [key, result.output.texts[index] ?? ''])),
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.localization.cacheTtlMs),
    };
    await this.transactions.run(async () => {
      const total = await this.localization.addUsage(userId, day, month, characters);
      // Messages stay out of the cache: a private conversation is not kept translated.
      if (request.sourceType !== 'message') await this.localization.saveTranslation(translation);
      await this.events.record(TranslationRequested, this.ids.next(), {
        sourceType: request.sourceType,
        targetLocale: target,
        provider: result.provider,
        characters,
        cached: false,
      });
      const cap = this.config.localization.monthlyCharactersCap;
      if (crossesWarning(total - characters, total, cap) && !monthly.warnedAt) {
        await this.localization.markWarned(month, now);
        this.metrics.increment('pitchorium.localization.cap.warning');
        this.logger.warn(`Translation usage of ${month} reached ${total} of ${cap} characters`);
      }
    });
    this.metrics.increment('pitchorium.localization.translated', { provider: result.provider });
    this.metrics.add('pitchorium.localization.characters', characters, {
      provider: result.provider,
    });
    return view(translation, false);
  }
}

/** Fingerprint of the original: any modification gives another one (cache invalidation). */
export function fingerprint(
  fields: Readonly<Record<string, string>>,
  language: string | null,
): string {
  const ordered = Object.keys(fields)
    .sort()
    .map((key) => [key, fields[key]]);
  return createHash('sha256')
    .update(JSON.stringify([language, ordered]))
    .digest('hex');
}

import type { INestApplicationContext } from '@nestjs/common';
import { RoleRepository } from '../../src/modules/access/application/ports';
import { TranslationService } from '../../src/modules/localization/application/translation.service';
import { PrivacyRequestsService } from '../../src/modules/privacy/application/privacy-requests.service';
import { ModerationService } from '../../src/modules/trust/application/moderation.service';
import { ReportsService } from '../../src/modules/trust/application/reports.service';
import { StandingService } from '../../src/modules/trust/application/standing.service';
import type { FixedClock } from '../../src/platform/kernel/clock';
import { demoId } from './seed-dev-data';

const HOUR_MS = 3_600_000;

export interface DevTrustResult {
  moderators: number;
  reports: number;
  decisions: number;
  appeals: number;
  exports: number;
  translations: number;
}

/** Demonstration moderators (they enable their two-factor authentication to use the tools). */
export const DEMO_MODERATORS = ['claudine', 'koffi'] as const;

/**
 * Reports, a decision with its statement of reasons and its appeal, an export request and
 * cached translations, through the services of trust, privacy and localization (ADR 0035).
 * Skipped when the demonstration reports exist.
 */
export async function seedDevTrust(
  context: INestApplicationContext,
  clock: FixedClock,
  now: Date = new Date(),
): Promise<DevTrustResult> {
  const get = <T>(type: abstract new (...args: never[]) => T): T =>
    context.get<T>(type, { strict: false });
  const userId = (key: string) => demoId(`member:${key}`);
  const result: DevTrustResult = {
    moderators: 0,
    reports: 0,
    decisions: 0,
    appeals: 0,
    exports: 0,
    translations: 0,
  };
  const reports = get(ReportsService);
  if ((await reports.mine(userId('fatou'), { limit: 1 })).items.length > 0) return result;

  for (const key of DEMO_MODERATORS) {
    const granted = await get(RoleRepository).grant(userId(key), {
      role: 'moderator',
      grantedAt: now,
      grantedBy: null,
    });
    if (granted) result.moderators += 1;
  }

  clock.set(new Date(now.getTime() - 48 * HOUR_MS));
  // A report waiting in the queue, and a report decided then appealed.
  await reports.report(userId('fatou'), {
    targetType: 'post',
    targetId: demoId('post:kente-launch'),
    reason: 'spam',
    details: 'Publication promotionnelle répétée.',
  });
  await reports.report(userId('grace'), {
    targetType: 'post',
    targetId: demoId('post:cacao-eudr'),
    reason: 'misleading_information',
    details: 'Les chiffres de rendement annoncés ne sont pas sourcés.',
  });
  result.reports = 2;

  clock.set(new Date(now.getTime() - 24 * HOUR_MS));
  const moderation = get(ModerationService);
  const [found] = (
    await moderation.queue(userId('claudine'), {
      status: 'open',
      assigned: 'any',
      targetType: 'post',
      limit: 10,
    })
  ).items.filter((item) => item.targetId === demoId('post:cacao-eudr'));
  if (found) {
    await moderation.assign(userId('claudine'), found.id, userId('claudine'));
    const decision = await moderation.decide(userId('claudine'), found.id, {
      kind: 'hide',
      reason: 'misleading_information',
      statement:
        'Les rendements annoncés ne sont accompagnés d’aucune source ; la publication est masquée jusqu’à leur ajout.',
      ground: 'terms',
      groundReference: 'Conditions d’utilisation, informations exactes',
      suspensionDays: null,
    });
    result.decisions = 1;
    clock.set(new Date(now.getTime() - 12 * HOUR_MS));
    await get(StandingService).appeal(
      userId('jeanbaptiste'),
      decision.id,
      'Les chiffres viennent du bilan de la coopérative, je peux le joindre.',
    );
    result.appeals = 1;
  }

  clock.set(now);
  await get(PrivacyRequestsService).requestExport(userId('aissatou'));
  result.exports = 1;
  const translations = get(TranslationService);
  for (const [reader, post] of [
    ['kofi', 'sahel-harvest'],
    ['samuel', 'sahel-harvest'],
  ] as const) {
    const translated = await translations.translate(userId(reader), {
      sourceType: 'post',
      sourceId: demoId(`post:${post}`),
      targetLocale: 'en',
    });
    if (!translated.cached) result.translations += 1;
  }
  return result;
}

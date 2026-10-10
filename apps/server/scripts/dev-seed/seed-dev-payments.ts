import type { INestApplicationContext } from '@nestjs/common';
import { EngagementService } from '../../src/modules/engagement/application/engagement.service';
import { EngagementRepository } from '../../src/modules/engagement/application/ports';
import {
  OFFLINE_CONTRIBUTION_RESOURCE,
  OfflineService,
} from '../../src/modules/payments/application/offline.service';
import { PayoutService } from '../../src/modules/payments/application/payout.service';
import { PaymentsRepository } from '../../src/modules/payments/application/ports';
import { ProjectRepository } from '../../src/modules/projects/application/ports';
import { slugBaseFromTitle } from '../../src/modules/projects/domain/project';
import type { FixedClock } from '../../src/platform/kernel';
import { DEMO_MEMBERS } from './dataset';
import { DEMO_PROJECTS } from './projects-dataset';
import { demoId, type PendingImage } from './seed-dev-data';

const DAY_MS = 86_400_000;
const euros = (amount: number) => ({ amountMinor: String(amount * 100), currency: 'EUR' });

export interface DevPaymentsResult {
  offlineContributions: number;
  kycStates: number;
  timeEntries: number;
  /** Proofs of the validated off-platform contributions, uploaded after the services run. */
  proofs: (PendingImage & { ownerId: string })[];
}

/**
 * The states of the payments the screens show (PROMPT FRONT 5B), through the services of the
 * modules (ADR 0035): off-platform contributions declared, confirmed, validated on proof and
 * refused, by a contributor and by a team; payout accounts with an identity check pending and
 * refused; shared time confirmed, disputed and waiting for its answer. Skipped when present, so
 * that a second run creates nothing. The proof of a validated contribution is listed for the
 * upload that follows (the decision only needs its reference).
 */
export async function seedDevPayments(
  context: INestApplicationContext,
  clock: FixedClock,
  now: Date,
): Promise<DevPaymentsResult> {
  const get = <T>(type: abstract new (...args: never[]) => T): T =>
    context.get<T>(type, { strict: false });
  const userId = (key: string) => demoId(`member:${key}`);
  const handleOf = (key: string) => {
    const handle = DEMO_MEMBERS.find((member) => member.key === key)?.handle;
    if (!handle) throw new Error(`No demonstration member ${key}`);
    return handle;
  };
  const projectId = async (key: string) => {
    const demo = DEMO_PROJECTS.find((project) => project.key === key);
    const resolved = demo
      ? await get(ProjectRepository).resolveSlug(slugBaseFromTitle(demo.title))
      : null;
    if (!resolved) throw new Error(`No demonstration project ${key}`);
    return resolved.projectId;
  };
  const result: DevPaymentsResult = {
    offlineContributions: 0,
    kycStates: 0,
    timeEntries: 0,
    proofs: [],
  };
  clock.set(new Date(now.getTime() - 2 * DAY_MS));

  const offline = get(OfflineService);
  const pompes = await projectId('pompes-thies');
  const existing = await get(PaymentsRepository).offlineContributions(
    { projectId: pompes },
    null,
    1,
  );
  if (existing.length === 0) {
    // Declared by a contributor, waiting for the team.
    await offline.declare(userId('nadia'), pompes, {
      kind: 'cash',
      amount: euros(200),
      description: 'Remis en main propre lors de la réunion de la coopérative.',
    });
    // Confirmed by the team, waiting for the validation on proof.
    const transfer = await offline.declare(userId('kofi'), pompes, {
      kind: 'institutional_transfer',
      amount: euros(1_000),
      description: 'Virement de mon cabinet, référence COOP-THIES.',
    });
    await offline.respond(transfer.id, userId('aissatou'), 'confirmed');
    // Refused by the team, with its reason.
    const skills = await offline.declare(userId('thierry'), pompes, {
      kind: 'skills_sponsorship',
      description: 'Deux jours de conseil juridique.',
    });
    await offline.respond(
      skills.id,
      userId('aissatou'),
      'rejected',
      'Nous ne retrouvons pas cette mission dans notre suivi : écrivez-nous pour en parler.',
    );
    // Declared by the team for a contributor, who answers.
    await offline.declare(
      userId('aissatou'),
      pompes,
      {
        kind: 'love_money_commitment',
        description: 'Engagement promis lors de la fête du village.',
      },
      handleOf('kofi'),
    );
    // Validated on proof by the moderation: counted in the amount collected.
    const soubre = await projectId('sechoir-soubre');
    const cash = await offline.declare(userId('fatou'), soubre, {
      kind: 'cash',
      amount: euros(300),
      description: 'Collecte de la tontine du quartier.',
    });
    await offline.respond(cash.id, userId('jeanbaptiste'), 'confirmed');
    const proof = demoId(`offline:${cash.id}:proof`);
    await get(PaymentsRepository).updateOffline(cash.id, { proofMediaIds: [proof] });
    await offline.decide(cash.id, userId('claudine'), 'validated', 'Reçu de la tontine conforme.');
    result.proofs.push({
      id: proof,
      kind: 'document',
      pages: 1,
      hue: 200,
      variant: 0,
      usage: 'verification_document',
      visibility: 'private',
      resource: { type: OFFLINE_CONTRIBUTION_RESOURCE, id: cash.id },
      ownerId: userId('fatou'),
    });
    result.offlineContributions += 5;
  }

  // Payout accounts in a covered country, with an identity check pending, and one refused.
  const payout = get(PayoutService);
  const kycStates: { member: string; country: string; refusal?: string }[] = [
    { member: 'moussa', country: 'FR' },
    {
      member: 'rodrigue',
      country: 'BE',
      refusal: 'La pièce est illisible : envoyez une photo nette de la pièce entière.',
    },
  ];
  for (const state of kycStates) {
    const id = userId(state.member);
    if (await get(PaymentsRepository).findPayoutAccount(id)) continue;
    await payout.create(id, {
      provider: 'simulated',
      country: state.country,
      eligibilityConfirmed: true,
      bankAccount: { bankCode: 'DEMO', accountNumber: '00000000', accountName: 'DEMO' },
    });
    const submission = await payout.submitKyc(id, { documentMediaIds: [], certification: true });
    if (state.refusal) await payout.decideKyc(submission.id, null, 'rejected', state.refusal);
    result.kycStates += 1;
  }

  // Shared time (section 6.3): confirmed, disputed, and waiting for its answer.
  const engagement = get(EngagementService);
  const already = await get(EngagementRepository).timeEntries(
    { contributorId: userId('marieclaire') },
    null,
    1,
  );
  if (already.length === 0) {
    const day = (daysAgo: number) =>
      new Date(now.getTime() - daysAgo * DAY_MS).toISOString().slice(0, 10);
    const mentoring = await engagement.declare(userId('kofi'), {
      projectId: await projectId('paiement-accra'),
      kind: 'mentoring',
      minutes: 120,
      date: day(6),
      description: 'Revue du modèle de revenus et des commissions des agents.',
    });
    await engagement.respond(mentoring.id, userId('ama'), 'confirmed');
    const expertise = await engagement.declare(userId('marieclaire'), {
      entrepreneurHandle: handleOf('aissatou'),
      kind: 'expertise',
      minutes: 90,
      date: day(4),
      description: 'Dimensionnement des panneaux pour les parcelles de la coopérative.',
    });
    await engagement.respond(
      expertise.id,
      userId('aissatou'),
      'disputed',
      'Cette séance a eu lieu une autre semaine, pour une durée d’une heure.',
    );
    await engagement.declare(userId('jeanbaptiste'), {
      projectId: pompes,
      kind: 'mentoring',
      minutes: 60,
      date: day(2),
      description: 'Partage de notre expérience de location-vente du séchoir.',
    });
    result.timeEntries += 3;
  }
  return result;
}

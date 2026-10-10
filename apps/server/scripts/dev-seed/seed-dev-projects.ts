import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PostsService } from '../../src/modules/content/application/posts.service';
import { ImpactFacade } from '../../src/modules/impact';
import { MethodologiesService } from '../../src/modules/impact/application/methodologies.service';
import { FollowsService } from '../../src/modules/network/application/follows.service';
import { ContributionEffectsService } from '../../src/modules/payments/application/contribution-effects.service';
import { ContributionsService } from '../../src/modules/payments/application/contributions.service';
import { PayoutService } from '../../src/modules/payments/application/payout.service';
import { PaymentsRepository } from '../../src/modules/payments/application/ports';
import { WebhooksService } from '../../src/modules/payments/application/webhooks.service';
import { ConfiguredPaymentProviders } from '../../src/modules/payments/infrastructure/payment-providers';
import { InterestsService } from '../../src/modules/projects/application/interests.service';
import { ProjectEventsRecorder } from '../../src/modules/projects/application/project-events.recorder';
import { ProjectMaintenanceService } from '../../src/modules/projects/application/project-maintenance.service';
import { ProjectRepository } from '../../src/modules/projects/application/ports';
import { ProjectsService } from '../../src/modules/projects/application/projects.service';
import { RewardsService } from '../../src/modules/projects/application/rewards.service';
import { TeamService } from '../../src/modules/projects/application/team.service';
import { UpdatesService } from '../../src/modules/projects/application/updates.service';
import { slugBaseFromTitle } from '../../src/modules/projects/domain/project';
import { parseWorkerConfig } from '../../src/platform/config/config';
import { TransactionManager } from '../../src/platform/database';
import { Clock, type FixedClock } from '../../src/platform/kernel';
import { DEMO_MEMBERS } from './dataset';
import {
  DEMO_FACET_ASSESSMENTS,
  DEMO_METHODOLOGY,
  DEMO_PAYOUT_COUNTRIES,
  DEMO_PROJECTS,
  type DemoProject,
} from './projects-dataset';
import { demoId } from './seed-dev-data';

const DAY_MS = 86_400_000;
const euros = (amount: number) => ({ amountMinor: String(amount * 100), currency: 'EUR' });
/** Euros in CFA francs at the fixed parity (655.957): exact for whole euros. */
const francs = (amount: number) => ({
  amountMinor: String((BigInt(amount) * 655_957n) / 1000n),
  currency: 'XOF',
});

/**
 * The demonstration pays through the simulated provider (ADR 0052), with institutional amounts
 * above the default bounds and no two-factor authentication: development settings only.
 */
const DEMO_PAYMENTS_ENV = {
  PAYMENTS_MODE: 'simulated',
  PAYMENTS_MAX_EUR_MINOR: '10000000',
  PAYMENTS_ENHANCED_VERIFICATION_EUR_MINOR: '10000000',
  PAYMENTS_CONTRIBUTIONS_PER_HOUR: '1000',
  PAYMENTS_SESSIONS_PER_METHOD_PER_HOUR: '1000',
};

/** Rows created by this run; a second run creates nothing. */
export interface DevProjectsResult {
  methodologies: number;
  assessments: number;
  projects: number;
  contributions: number;
  /** Follows of projects; the follows of members are counted by seedDevData. */
  projectFollows: number;
  /** Publications attached to a project. */
  projectPosts: number;
}

/**
 * The api application graph with a clock the script controls, so that the services date the
 * campaigns in the past (publication, contributions, end) like real use would. Development
 * tool only: it relies on @nestjs/testing to replace the clock.
 */
export async function createSeedContext(clock: FixedClock): Promise<INestApplicationContext> {
  Object.assign(process.env, DEMO_PAYMENTS_ENV);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Clock)
    .useValue(clock)
    .compile();
  moduleRef.useLogger(false);
  return moduleRef.init();
}

/**
 * Demonstration methodology, assessments, projects in every status, follows and attached
 * publications, written through the application services and facades of the modules (ADR
 * 0035): their invariants, events (outbox) and audit apply. Each project is seeded in one
 * transaction, skipped when its slug exists, so that a second run creates nothing.
 */
export async function seedDevProjects(
  context: INestApplicationContext,
  clock: FixedClock,
  now: Date = new Date(),
): Promise<DevProjectsResult> {
  const get = <T>(type: abstract new (...args: never[]) => T): T =>
    context.get<T>(type, { strict: false });
  const userId = (key: string) => demoId(`member:${key}`);
  const handleOf = (key: string) =>
    DEMO_MEMBERS.find((member) => member.key === key)?.handle ?? key;
  const result: DevProjectsResult = {
    methodologies: 0,
    assessments: 0,
    projects: 0,
    contributions: 0,
    projectFollows: 0,
    projectPosts: 0,
  };
  const impact = get(ImpactFacade);
  const transactions = get(TransactionManager);
  const repository = get(ProjectRepository);

  clock.set(new Date(now.getTime() - 120 * DAY_MS));
  const hadMethodology = (await impact.publishedMethodology()) !== null;
  const methodology = await get(MethodologiesService).ensureDemo(DEMO_METHODOLOGY);
  if (!hadMethodology) result.methodologies += 1;
  if ((await impact.publishedMethodology())?.id !== methodology.id) {
    throw new Error('Another methodology than the DEMO one is published: no demo assessment');
  }

  for (const [key, answers] of Object.entries(DEMO_FACET_ASSESSMENTS)) {
    const subject = { type: 'entrepreneur_facet' as const, id: userId(key) };
    if (await impact.current(subject)) continue;
    await impact.submit({
      subject,
      submittedBy: subject.id,
      methodologyId: methodology.id,
      answers,
    });
    result.assessments += 1;
  }

  for (const demo of DEMO_PROJECTS) {
    if (await repository.resolveSlug(slugBaseFromTitle(demo.title))) continue;
    await transactions.run(() => seedProject(demo));
    result.projects += 1;
  }

  // Campaigns whose end date passed are closed, those ending soon announced, as the worker does.
  clock.set(now);
  const maintenance = new ProjectMaintenanceService(
    parseWorkerConfig(process.env),
    repository,
    get(ProjectEventsRecorder),
    transactions,
    clock,
  );
  await maintenance.closeEnded();
  await maintenance.announceEndingSoon();
  return result;

  /**
   * Payout account at the simulated provider in the country the holder chose, and identity
   * verified, as a holder does before collecting (section 9.5). The KYC decision is a
   * demonstration decision without reviewer.
   */
  async function readyToCollect(owner: string): Promise<void> {
    const ownerId = userId(owner);
    const country = DEMO_PAYOUT_COUNTRIES[owner];
    if (!country) throw new Error(`No demonstration payout country for ${owner}`);
    const payout = get(PayoutService);
    if (!(await get(PaymentsRepository).findPayoutAccount(ownerId))) {
      await payout.create(ownerId, {
        provider: 'simulated',
        country,
        eligibilityConfirmed: true,
        bankAccount: { bankCode: 'DEMO', accountNumber: '00000000', accountName: 'DEMO' },
      });
    }
    if (await payout.isKycVerified(ownerId)) return;
    const submission = await payout.submitKyc(ownerId, {
      documentMediaIds: [],
      certification: true,
    });
    await payout.decideKyc(submission.id, null, 'approved', 'Données de démonstration.');
  }

  /**
   * A contribution paid like a real one (A1): payment session at the simulated provider, signed
   * notification received by the webhook ingestion, state read again from the provider, then
   * ledger, collected amount and reward through the payments module.
   */
  async function pay(
    projectId: string,
    contribution: NonNullable<DemoProject['contributions']>[number],
    rewardIds: readonly string[],
    index: number,
  ): Promise<void> {
    const rewardId =
      contribution.rewardIndex === undefined ? undefined : rewardIds[contribution.rewardIndex];
    const request = {
      kind: rewardId ? ('reward_crowdfunding' as const) : ('donation' as const),
      amount: contribution.inXof ? francs(contribution.amount) : euros(contribution.amount),
      method: 'card' as const,
      ...(rewardId ? { rewardId } : {}),
      publicDisplay: index % 2 === 0,
      anonymous: false,
    };
    const contributions = get(ContributionsService);
    const created = await contributions.create(
      userId(contribution.contributor),
      projectId,
      request,
      contribution.organization ? demoId(`organization:${contribution.organization}`) : null,
    );
    const simulated = get(ConfiguredPaymentProviders).simulated;
    if (!simulated) throw new Error('db:seed:dev needs the simulated payment provider');
    const webhook = await simulated.play(`sim_cs_${created.id}`, 'succeed');
    await get(WebhooksService).ingest('simulated', webhook.headers, Buffer.from(webhook.body));
    const paid = await get(ContributionEffectsService).sync(created.id);
    if (paid?.status !== 'succeeded') throw new Error(`Demo contribution ${created.id} not paid`);
  }

  async function seedProject(demo: DemoProject): Promise<void> {
    const ownerId = userId(demo.owner);
    const publishedAt =
      demo.publishedDaysAgo === undefined
        ? null
        : new Date(now.getTime() - demo.publishedDaysAgo * DAY_MS);
    const at = (days: number) =>
      clock.set(new Date((publishedAt ?? now).getTime() + days * DAY_MS));
    at(-3);
    const projects = get(ProjectsService);
    const created = await projects.create(ownerId, {
      title: demo.title,
      ...(demo.organizationKey
        ? { organizationId: demoId(`organization:${demo.organizationKey}`) }
        : {}),
      ...(demo.summary ? { summary: demo.summary } : {}),
      ...(demo.description ? { description: demo.description } : {}),
      ...(demo.sectorCode ? { sectorCode: demo.sectorCode } : {}),
      ...(demo.impactArea ? { impactArea: demo.impactArea } : {}),
      ...(demo.countryCodes ? { countryCodes: demo.countryCodes } : {}),
      ...(demo.videoUrl ? { videoUrl: demo.videoUrl } : {}),
      ...(demo.instruments ? { instruments: demo.instruments } : {}),
      ...(demo.opensCapital ? { opensCapital: true } : {}),
      ...(demo.durationDays ? { durationDays: demo.durationDays } : {}),
    });
    const projectId = created.id;
    if (demo.tiers) {
      await projects.replaceTiers(
        projectId,
        ownerId,
        demo.tiers.map((tier) => ({
          threshold: euros(tier.threshold),
          description: tier.description,
        })),
      );
    }
    const rewards = get(RewardsService);
    const rewardIds: string[] = [];
    for (const reward of demo.rewards ?? []) {
      const createdReward = await rewards.create(projectId, {
        title: reward.title,
        description: reward.description,
        minAmount: euros(reward.minAmount),
        instruments: reward.instruments,
        quantity: reward.quantity ?? null,
        estimatedDelivery: reward.estimatedDelivery ?? null,
      });
      rewardIds.push(createdReward.id);
    }
    if (demo.editor) {
      const team = get(TeamService);
      await team.invite(projectId, ownerId, {
        handle: handleOf(demo.editor.member),
        role: 'editor',
        function: demo.editor.function,
      });
      await team.accept(projectId, userId(demo.editor.member));
    }
    if (!publishedAt) return;

    at(0);
    await projects.publish(projectId, ownerId, true);
    if (demo.contributions?.length) await readyToCollect(demo.owner);
    for (const [index, contribution] of (demo.contributions ?? []).entries()) {
      at(contribution.daysAfterPublication);
      await pay(projectId, contribution, rewardIds, index);
      result.contributions += 1;
    }
    for (const update of demo.updates ?? []) {
      at(update.daysAfterPublication);
      await get(UpdatesService).publish(projectId, userId(update.author), { text: update.text });
    }
    at(Math.min(demo.publishedDaysAgo ?? 0, 2));
    for (const interest of demo.interests ?? []) {
      await get(InterestsService).express(projectId, userId(interest.member), {
        kind: interest.kind,
        message: interest.message,
        ...(interest.amount ? { indicativeAmount: euros(interest.amount) } : {}),
      });
    }
    for (const follower of demo.followers ?? []) {
      await get(FollowsService).follow(userId(follower), 'project', projectId);
      result.projectFollows += 1;
    }
    for (const post of demo.posts ?? []) {
      await get(PostsService).create(userId(post.author), {
        text: post.text,
        projectId,
        visibility: 'members',
        commentsDisabled: false,
      });
      result.projectPosts += 1;
    }
  }
}

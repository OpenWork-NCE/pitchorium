import { Inject, Injectable } from '@nestjs/common';
import type {
  Contribution,
  ContributionStatus,
  CreateContributionRequest,
  CursorPage,
  ProjectContribution,
  Supporter,
  SupporterPage,
} from '@pitchorium/contracts';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import {
  Clock,
  decodeKeyset,
  DomainError,
  encodeKeyset,
  IdGenerator,
} from '../../../platform/kernel';
import { IdentityFacade } from '../../identity';
import { OrganizationsFacade } from '../../organizations';
import { ProfilesFacade } from '../../profiles';
import { ProjectsFacade } from '../../projects';
import type { ContributionRecord } from '../domain/contribution';
import { ContributionCreated } from '../domain/payments-events';
import { ContributionEffectsService } from './contribution-effects.service';
import { contributionView, projectContributionViews } from './payments-views';
import { PaymentsEventsRecorder } from './payments-events.recorder';
import { PaymentProviders, PaymentsRepository } from './ports';
import { QuotesService } from './quotes.service';

const HOUR_MS = 3_600_000;

export const contributionNotFound = () =>
  new DomainError('PAYMENTS_CONTRIBUTION_NOT_FOUND', 'Contribution not found');

/**
 * Collected contributions (section 9.3): one payment session on the hosted page of the
 * provider of the holder's route, a reward unit reserved for its duration, then the state the
 * provider reports (ContributionEffectsService). A contributor gives in their own name or for an
 * organization they own or administer (section 10.7).
 */
@Injectable()
export class ContributionsService {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly quotes: QuotesService,
    private readonly effects: ContributionEffectsService,
    private readonly providers: PaymentProviders,
    private readonly projects: ProjectsFacade,
    private readonly identity: IdentityFacade,
    private readonly profiles: ProfilesFacade,
    private readonly organizations: OrganizationsFacade,
    private readonly events: PaymentsEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  async create(
    contributorId: string,
    projectId: string,
    request: CreateContributionRequest,
    organizationId: string | null = null,
  ): Promise<Contribution> {
    const settings = this.config.payments;
    const user = await this.identity.findUser(contributorId);
    if (!user) throw new DomainError('IDENTITY_USER_NOT_FOUND', 'User not found');
    const prepared = await this.quotes.prepare(projectId, contributorId, request);
    const { quote, context, payment } = prepared;
    if (request.anonymous && (!settings.anonymousDonations || quote.kind !== 'donation')) {
      throw new DomainError('PAYMENTS_ANONYMOUS_NOT_ALLOWED', 'Anonymous contributions refused');
    }
    if (quote.reward?.soldOut) {
      throw new DomainError('PROJECTS_REWARD_SOLD_OUT', 'Reward sold out');
    }
    if (quote.reward && !quote.reward.eligible) {
      throw new DomainError('PAYMENTS_REWARD_NOT_ELIGIBLE', 'Reward not obtained');
    }
    if (
      quote.eurEquivalent.amountMinor > settings.enhancedVerificationEurMinor &&
      !user.twoFactorEnabled
    ) {
      throw new DomainError('ACCESS_PREREQUISITES_MISSING', 'Enhanced verification required', {
        missing: ['two_factor'],
      });
    }
    const now = this.clock.now();
    const since = new Date(now.getTime() - HOUR_MS);
    if (
      (await this.payments.countRecentContributions(contributorId, since)) >=
        settings.contributionsPerHour ||
      (await this.payments.countRecentContributions(contributorId, since, payment.method)) >=
        settings.sessionsPerMethodPerHour
    ) {
      throw new DomainError('PAYMENTS_RATE_LIMITED', 'Too many contributions started');
    }
    const contribution: ContributionRecord = {
      id: this.ids.next(),
      projectId,
      contributorId,
      organizationId,
      holderId: context.project.ownerId,
      kind: quote.kind,
      status: 'pending_payment',
      method: payment.method,
      country: context.contributorCountry,
      provider: context.route.provider,
      providerAccountId: context.account.providerAccountId,
      providerSessionId: null,
      providerPaymentId: null,
      paymentUrl: null,
      amountMinor: quote.amount.amountMinor,
      currency: quote.amount.currency,
      eurMinor: quote.eurEquivalent.amountMinor,
      rateUnitsPerEur: quote.rate.unitsPerEur,
      rateSource: quote.rate.source,
      rateAt: quote.rate.at,
      commissionMinor: quote.commission.amountMinor,
      commissionRateBps: quote.terms.rateBps,
      commissionVersion: quote.terms.version,
      providerFeeMinor: null,
      refundedMinor: 0n,
      refundedEurMinor: 0n,
      commissionRefundedMinor: 0n,
      lostMinor: 0n,
      lostEurMinor: 0n,
      rewardId: quote.reward?.rewardId ?? null,
      rewardState: quote.reward ? 'reserved' : 'none',
      publicDisplay: request.publicDisplay,
      anonymous: request.anonymous,
      // The reward is reserved for the lifetime of the session (ADR 0041).
      expiresAt: new Date(now.getTime() + settings.sessionTtlMs),
      createdAt: now,
      updatedAt: now,
      succeededAt: null,
      endedAt: null,
    };
    await this.transactions.run(async () => {
      await this.payments.insertContribution(contribution);
      if (contribution.rewardId)
        await this.projects.reserve(contribution.rewardId, contribution.id);
      await this.events.record(ContributionCreated, contribution.id, {
        projectId,
        contributorId,
        organizationId,
        kind: contribution.kind,
        amountMinor: contribution.amountMinor.toString(),
        currency: contribution.currency,
        eurMinor: contribution.eurMinor.toString(),
      });
    });
    let session: { sessionId: string; paymentUrl: string };
    try {
      // Outside any transaction (ADR 0019): the hosted page of the provider.
      session = await this.providers.payment(contribution.provider).createSession({
        contributionId: contribution.id,
        providerAccountId: contribution.providerAccountId,
        amount: quote.amount,
        commission: quote.commission,
        method: payment.method,
        expiresAt: contribution.expiresAt,
        contributorEmail: user.email,
        contributorName: user.name,
        description: context.project.title,
        locale: user.locale,
        returnUrl: `${this.config.webAppUrl}/contributions/${contribution.id}/return`,
      });
    } catch (error) {
      await this.transactions.run(async () => {
        const locked = await this.payments.lockContribution(contribution.id);
        if (locked?.status === 'pending_payment') {
          await this.effects.end(locked, 'failed', 'session_failed');
        }
      });
      throw error;
    }
    await this.payments.updateContribution(contribution.id, {
      providerSessionId: session.sessionId,
      paymentUrl: session.paymentUrl,
      updatedAt: this.clock.now(),
    });
    return this.view(contributorId, contribution.id);
  }

  /** The contributor gives up before paying: the reward unit is released. */
  async cancel(contributorId: string, contributionId: string): Promise<Contribution> {
    await this.transactions.run(async () => {
      const contribution = await this.payments.lockContribution(contributionId);
      if (!contribution || contribution.contributorId !== contributorId)
        throw contributionNotFound();
      if (contribution.status !== 'pending_payment') {
        throw new DomainError('PAYMENTS_INVALID_TRANSITION', 'Only a pending payment is canceled');
      }
      await this.effects.end(contribution, 'canceled', 'contributor');
    });
    return this.view(contributorId, contributionId);
  }

  /** Back from the page of the provider: its current state, read through its API. */
  async returned(contributorId: string, contributionId: string): Promise<Contribution> {
    const contribution = await this.payments.findContribution(contributionId);
    if (!contribution || contribution.contributorId !== contributorId) throw contributionNotFound();
    await this.effects.sync(contributionId);
    return this.view(contributorId, contributionId);
  }

  async view(contributorId: string, contributionId: string): Promise<Contribution> {
    const contribution = await this.payments.findContribution(contributionId);
    if (!contribution || contribution.contributorId !== contributorId) throw contributionNotFound();
    const [view] = await this.views([contribution]);
    if (!view) throw contributionNotFound();
    return view;
  }

  async mine(
    contributorId: string,
    query: { cursor?: string | undefined; limit: number; status?: ContributionStatus | undefined },
  ): Promise<CursorPage<Contribution>> {
    const rows = await this.payments.contributions(
      { contributorId, ...(query.status ? { status: query.status } : {}) },
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    return this.page(rows, query.limit, (items) => this.views(items));
  }

  /** Contributions of a project for its owners, the contributor shown unless anonymous. */
  async ofProject(
    projectId: string,
    query: { cursor?: string | undefined; limit: number; status?: ContributionStatus | undefined },
  ): Promise<CursorPage<ProjectContribution>> {
    const rows = await this.payments.contributions(
      { projectId, ...(query.status ? { status: query.status } : {}) },
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    return this.page(rows, query.limit, (items) => this.projectViews(items));
  }

  async projectViews(rows: readonly ContributionRecord[]): Promise<ProjectContribution[]> {
    const [base, cards, organizations] = await Promise.all([
      this.views(rows),
      this.profiles.memberCards(
        rows.filter((row) => !row.anonymous).map((row) => row.contributorId),
      ),
      this.organizations.summaries(
        rows.flatMap((row) => (row.organizationId ? [row.organizationId] : [])),
      ),
    ]);
    return projectContributionViews(rows, base, cards, organizations);
  }

  /** Members and organizations who opted in; counts of paid contributions and commitments. */
  async supporters(
    projectId: string,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<SupporterPage> {
    const project = await this.projects.fundable(projectId);
    if (!project?.showable) throw new DomainError('PROJECTS_NOT_FOUND', 'Project not found');
    const rows = await this.payments.publicSupporters(
      projectId,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const pageRows = rows.slice(0, query.limit);
    const [cards, organizations, contributionCount, commitmentCount] = await Promise.all([
      this.profiles.memberCards(
        pageRows.filter((row) => !row.organizationId).map((row) => row.contributorId),
      ),
      this.organizations.cards(
        pageRows.flatMap((row) => (row.organizationId ? [row.organizationId] : [])),
      ),
      this.payments.countPaidContributions(projectId),
      this.payments.countCommitments(projectId),
    ]);
    const last = pageRows.at(-1);
    return {
      items: pageRows.flatMap((row): Supporter[] => {
        const supportedAt = (row.succeededAt ?? row.createdAt).toISOString();
        if (row.organizationId) {
          const organization = organizations.get(row.organizationId);
          return organization
            ? [
                {
                  type: 'organization' as const,
                  displayName: organization.name,
                  key: organization.slug,
                  avatarUrl: organization.logoUrl,
                  kind: row.kind,
                  supportedAt,
                },
              ]
            : [];
        }
        const card = cards.get(row.contributorId);
        return card
          ? [
              {
                type: 'member' as const,
                displayName: card.displayName,
                key: card.handle,
                avatarUrl: card.avatarUrl,
                kind: row.kind,
                supportedAt,
              },
            ]
          : [];
      }),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.succeededAt ?? last.createdAt, key: last.id })
          : null,
      contributionCount,
      commitmentCount,
    };
  }

  async views(rows: readonly ContributionRecord[]): Promise<Contribution[]> {
    const projects = await this.projects.fundables([...new Set(rows.map((row) => row.projectId))]);
    return rows.flatMap((row) => {
      const project = projects.get(row.projectId);
      return project ? [contributionView(row, project)] : [];
    });
  }

  private async page<T>(
    rows: ContributionRecord[],
    limit: number,
    present: (rows: ContributionRecord[]) => Promise<T[]>,
  ): Promise<CursorPage<T>> {
    const pageRows = rows.slice(0, limit);
    const last = pageRows.at(-1);
    return {
      items: await present(pageRows),
      nextCursor:
        rows.length > limit && last ? encodeKeyset({ at: last.createdAt, key: last.id }) : null,
    };
  }
}

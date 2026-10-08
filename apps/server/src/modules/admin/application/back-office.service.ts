import { Injectable } from '@nestjs/common';
import type {
  AuditEntry,
  AuditQuery,
  CursorPage,
  FailedJob,
  FeatureFlagView,
  Highlight,
  HighlightTargetType,
  JobRetryResult,
  MemberFile,
  MemberSearchQuery,
  MemberSummary,
  PlatformStats,
  UpdateFeatureFlagRequest,
} from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { TransactionManager } from '../../../platform/database';
import { FeatureFlagsService } from '../../../platform/feature-flags';
import {
  Clock,
  decodeCursor,
  decodeKeyset,
  DomainError,
  encodeCursor,
  encodeKeyset,
  IdGenerator,
} from '../../../platform/kernel';
import { FailedJobsService } from '../../../platform/queue';
import { AccessFacade } from '../../access';
import { ContentFacade } from '../../content';
import { type IdentityUser, IdentityFacade } from '../../identity';
import { LocalizationFacade } from '../../localization';
import { PaymentsFacade } from '../../payments';
import { PrivacyFacade } from '../../privacy';
import { ProfilesFacade } from '../../profiles';
import { ProjectsFacade } from '../../projects';
import { TrustFacade } from '../../trust';
import { assertLegalReference, localeOfFlag } from '../domain/flags';
import { AdminRepository } from './ports';

const HIGHLIGHTS_LISTED = 100;

/**
 * The back office (§13, §14): members, feature flags with their guardrails, editorial
 * highlights, jobs failed for good, statistics and the audit log. Every reading of personal
 * data by an administrator is audited.
 */
@Injectable()
export class BackOfficeService {
  constructor(
    private readonly identity: IdentityFacade,
    private readonly access: AccessFacade,
    private readonly profiles: ProfilesFacade,
    private readonly content: ContentFacade,
    private readonly projects: ProjectsFacade,
    private readonly payments: PaymentsFacade,
    private readonly trust: TrustFacade,
    private readonly privacy: PrivacyFacade,
    private readonly localization: LocalizationFacade,
    private readonly flags: FeatureFlagsService,
    private readonly jobs: FailedJobsService,
    private readonly admin: AdminRepository,
    private readonly audit: AuditService,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async searchMembers(
    actorId: string,
    query: MemberSearchQuery,
  ): Promise<CursorPage<MemberSummary>> {
    const fields = query.cursor ? decodeCursor(query.cursor) : null;
    const after =
      fields?.['email'] && fields['key'] ? { email: fields['email'], id: fields['key'] } : null;
    const users = await this.identity.searchUsers(query.q, after, query.limit + 1);
    // A handle typed exactly finds its member too.
    const byHandle = !after ? await this.profiles.userIdOf(query.q) : null;
    if (byHandle && !users.some((user) => user.id === byHandle)) {
      const user = await this.identity.findUser(byHandle);
      if (user) users.unshift(user);
    }
    const page = users.slice(0, query.limit);
    await this.audit.record({
      actor: { type: 'user', id: actorId },
      action: 'admin.members-searched',
      target: { type: 'member_search', id: query.q.slice(0, 64) },
      metadata: { results: page.length },
    });
    const last = page.at(-1);
    return {
      items: await this.summaries(page),
      nextCursor:
        users.length > query.limit && last
          ? encodeCursor({ email: last.email, key: last.id })
          : null,
    };
  }

  async memberFile(actorId: string, userId: string): Promise<MemberFile> {
    const user = await this.identity.findUser(userId);
    if (!user) throw new DomainError('ADMIN_MEMBER_NOT_FOUND', 'Member not found');
    const [[summary], suspension, trust] = await Promise.all([
      this.summaries([user]),
      this.trust.activeSuspension(userId),
      this.access.trustLevels(userId, user.emailVerified),
    ]);
    await this.audit.record({
      actor: { type: 'user', id: actorId },
      action: 'admin.member-viewed',
      target: { type: 'user', id: userId },
    });
    return {
      ...summary!,
      locale: user.locale,
      timeZone: user.timeZone,
      twoFactorEnabled: user.twoFactorEnabled,
      legal: {
        termsVersion: user.acceptedTermsVersion,
        privacyVersion: user.acceptedPrivacyVersion,
      },
      suspension: suspension
        ? { id: suspension.id, endsAt: suspension.endsAt?.toISOString() ?? null }
        : null,
      kycVerified: trust.kycVerified,
    };
  }

  async flagList(): Promise<FeatureFlagView[]> {
    const [flags, references] = await Promise.all([
      this.flags.list(),
      this.admin.legalReferences(),
    ]);
    return flags.map((flag) => ({
      key: flag.key,
      enabled: flag.enabled,
      description: flag.description,
      updatedAt: flag.updatedAt.toISOString(),
      legalReference: references.get(flag.key) ?? null,
    }));
  }

  /**
   * A locale goes through the localization module (complete and reviewed catalogue); equity
   * and loans need a legal reference; every change is recorded with its author and audited.
   */
  async updateFlag(
    actorId: string,
    key: string,
    request: UpdateFeatureFlagRequest,
  ): Promise<FeatureFlagView> {
    const existing = (await this.flags.list()).find((flag) => flag.key === key);
    if (!existing) throw new DomainError('ADMIN_FLAG_NOT_FOUND', 'Feature flag not found');
    assertLegalReference(key, request.enabled, request.legalReference);
    await this.transactions.run(async () => {
      const locale = localeOfFlag(key);
      if (locale) await this.localization.setLocaleEnabled(locale, request.enabled, actorId);
      else await this.flags.set(key, request.enabled);
      await this.admin.insertFlagChange({
        id: this.ids.next(),
        key,
        enabled: request.enabled,
        legalReference: request.legalReference,
        changedBy: actorId,
        changedAt: this.clock.now(),
      });
      await this.audit.record({
        actor: { type: 'user', id: actorId },
        action: 'admin.flag-changed',
        target: { type: 'feature_flag', id: key },
        metadata: { enabled: request.enabled, legalReference: request.legalReference },
      });
    });
    const updated = (await this.flagList()).find((flag) => flag.key === key);
    if (!updated) throw new DomainError('ADMIN_FLAG_NOT_FOUND', 'Feature flag not found');
    return updated;
  }

  async highlights(type: HighlightTargetType | undefined): Promise<Highlight[]> {
    const lists = await Promise.all([
      !type || type === 'post'
        ? this.content
            .featuredPosts(HIGHLIGHTS_LISTED)
            .then((rows) => rows.map((row) => highlight('post', row.id, row.featuredAt)))
        : [],
      !type || type === 'project'
        ? this.projects
            .featuredProjects(HIGHLIGHTS_LISTED)
            .then((rows) => rows.map((row) => highlight('project', row.id, row.featuredAt)))
        : [],
      !type || type === 'profile'
        ? this.profiles
            .featuredProfiles(HIGHLIGHTS_LISTED)
            .then((rows) => rows.map((row) => highlight('profile', row.handle, row.featuredAt)))
        : [],
    ]);
    return lists.flat().sort((a, b) => b.featuredAt.localeCompare(a.featuredAt));
  }

  /** One interface for the editorial highlights of publications, projects and profiles. */
  async setHighlight(
    actorId: string,
    type: HighlightTargetType,
    id: string,
    featured: boolean,
  ): Promise<void> {
    try {
      if (type === 'post') await this.content.setPostFeatured(id, actorId, featured);
      else if (type === 'project') await this.projects.setProjectFeatured(id, actorId, featured);
      else await this.profiles.setProfileFeatured(id, actorId, featured);
    } catch (error) {
      if (
        error instanceof DomainError &&
        ['CONTENT_POST_NOT_FOUND', 'PROJECTS_NOT_FOUND', 'PROFILES_PROFILE_NOT_FOUND'].includes(
          error.code,
        )
      ) {
        throw new DomainError('ADMIN_HIGHLIGHT_TARGET_NOT_FOUND', 'Content to highlight not found');
      }
      throw error;
    }
  }

  async failedJobs(queue: string | undefined, limit: number): Promise<FailedJob[]> {
    if (queue && !(await this.jobs.queueNames()).includes(queue)) {
      throw new DomainError('ADMIN_QUEUE_NOT_FOUND', 'Queue not found');
    }
    return (await this.jobs.failed(queue, limit)).map((job) => ({
      ...job,
      failedAt: job.failedAt?.toISOString() ?? null,
    }));
  }

  /** Audited and idempotent: a job retried meanwhile is not retried twice. */
  async retryJob(actorId: string, queue: string, jobId: string): Promise<JobRetryResult> {
    if (!(await this.jobs.queueNames()).includes(queue)) {
      throw new DomainError('ADMIN_QUEUE_NOT_FOUND', 'Queue not found');
    }
    const outcome = await this.jobs.retry(queue, jobId);
    await this.transactions.run(() =>
      this.audit.record({
        actor: { type: 'user', id: actorId },
        action: 'admin.job-retried',
        target: { type: 'job', id: `${queue}:${jobId}`.slice(0, 200) },
        metadata: { outcome },
      }),
    );
    return { queue, id: jobId, outcome };
  }

  async statistics(): Promise<PlatformStats> {
    const [members, projects, payments, trust, rights, failedJobs] = await Promise.all([
      this.identity.memberCounts(this.clock.now()),
      this.projects.countByStatus(),
      this.payments.statistics(),
      this.trust.pendingCounts(),
      this.privacy.openRequests(),
      this.jobs.failedCount(),
    ]);
    return {
      members: { total: members.total, active30Days: members.active },
      projects,
      contributions: {
        succeeded: payments.succeeded,
        collectedEurMinor: payments.collectedEurMinor.toString(),
      },
      pending: {
        moderationCases: trust.cases,
        appeals: trust.appeals,
        kycReviews: payments.kycPending,
        offlineContributions: payments.offlinePending,
        rightsRequests: rights,
        failedJobs,
      },
    };
  }

  /** The audit log, filtered; reading it is audited too. */
  async auditLog(actorId: string, query: AuditQuery): Promise<CursorPage<AuditEntry>> {
    const rows = await this.audit.search(
      {
        actorId: query.actorId,
        action: query.action,
        targetType: query.targetType,
        targetId: query.targetId,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    await this.transactions.run(() =>
      this.audit.record({
        actor: { type: 'user', id: actorId },
        action: 'admin.audit-read',
        target: { type: 'audit_log', id: query.targetId ?? query.actorId ?? 'all' },
      }),
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() })),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.occurredAt, key: last.id })
          : null,
    };
  }

  private async summaries(users: readonly IdentityUser[]): Promise<MemberSummary[]> {
    const cards = await this.profiles.memberCards(users.map((user) => user.id));
    return Promise.all(
      users.map(async (user) => ({
        userId: user.id,
        email: user.email,
        name: user.name,
        handle: cards.get(user.id)?.handle ?? null,
        roles: await this.access.rolesOf(user.id),
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.toISOString(),
      })),
    );
  }
}

function highlight(targetType: HighlightTargetType, targetId: string, at: Date | null): Highlight {
  return { targetType, targetId, featuredAt: (at ?? new Date(0)).toISOString() };
}

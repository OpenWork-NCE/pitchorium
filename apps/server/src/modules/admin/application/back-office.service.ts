import { Injectable } from '@nestjs/common';
import {
  type Action,
  AUDIT_EXPORT_MAX,
  type AuditEntry,
  type AuditExportQuery,
  type AuditQuery,
  type ConsoleQueue,
  type ConsoleQueues,
  type CursorPage,
  type FailedJob,
  type FeatureFlagChange,
  type FeatureFlagGuard,
  type FeatureFlagView,
  type Highlight,
  type HighlightTargetType,
  type JobRetryResult,
  type MemberFile,
  type MemberSearchQuery,
  type MemberSummary,
  type PlatformStats,
  type UpdateFeatureFlagRequest,
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
import { AccessFacade, type Actor } from '../../access';
import { ContentFacade } from '../../content';
import { type IdentityUser, IdentityFacade } from '../../identity';
import { LocalizationFacade } from '../../localization';
import { OrganizationsFacade } from '../../organizations';
import { PaymentsFacade } from '../../payments';
import { PrivacyFacade } from '../../privacy';
import { ProfilesFacade } from '../../profiles';
import { ProjectsFacade } from '../../projects';
import { TrustFacade } from '../../trust';
import { auditCsv } from '../domain/audit-csv';
import { assertLegalReference, fundingInstrumentOfFlag, localeOfFlag } from '../domain/flags';
import { highlightPositions } from '../domain/highlights';
import { AdminRepository } from './ports';

const HIGHLIGHTS_LISTED = 100;
/** Decisions, contributions and changes of a flag listed by a file. */
const FILE_ITEMS = 20;

/** The action that opens each queue of the console to its reader. */
const QUEUE_ACTIONS: Readonly<Record<ConsoleQueue, Action>> = {
  moderation_cases: 'trust.moderation.read',
  appeals: 'trust.moderation.read',
  organization_verifications: 'organization.verification.review',
  kyc_reviews: 'payment.kyc.review',
  offline_contributions: 'payment.offline.validate',
  discrepancies: 'payment.reconciliation.manage',
  failed_jobs: 'admin.jobs.read',
  rights_requests: 'privacy.requests.read',
};

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
    private readonly organizations: OrganizationsFacade,
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
    const [[summary], suspension, trust, sessions, decisions, contributions] = await Promise.all([
      this.summaries([user]),
      this.trust.activeSuspension(userId),
      this.access.trustLevels(userId, user.emailVerified),
      this.identity.sessionsOf(userId),
      this.trust.decisionsAbout(userId, FILE_ITEMS),
      this.payments.contributionsOf(userId, FILE_ITEMS),
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
      sessions: sessions.map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        createdAt: session.createdAt.toISOString(),
        lastActiveAt: session.lastActiveAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
      })),
      decisions,
      contributions: contributions.map((contribution) => ({
        ...contribution,
        createdAt: contribution.createdAt.toISOString(),
      })),
    };
  }

  /** Signs a member out on every device; audited. Their next sign-in opens a new session. */
  async revokeSessions(actorId: string, userId: string): Promise<void> {
    if (!(await this.identity.findUser(userId))) {
      throw new DomainError('ADMIN_MEMBER_NOT_FOUND', 'Member not found');
    }
    await this.transactions.run(async () => {
      await this.identity.revokeAllSessions(userId, 'administration');
      await this.audit.record({
        actor: { type: 'user', id: actorId },
        action: 'admin.sessions-revoked',
        target: { type: 'user', id: userId },
      });
    });
  }

  /** The queues the reader may work in, by their rights, with what waits in each. */
  async queues(actor: Actor): Promise<ConsoleQueues> {
    const open = await Promise.all(
      (Object.entries(QUEUE_ACTIONS) as [ConsoleQueue, Action][]).map(async ([queue, action]) =>
        (await this.access.allows(actor, action)) ? queue : null,
      ),
    );
    const readable = open.filter((queue): queue is ConsoleQueue => queue !== null);
    const needs = (...queues: ConsoleQueue[]) => queues.some((queue) => readable.includes(queue));
    const [trust, payments, verifications, rights, failedJobs] = await Promise.all([
      needs('moderation_cases', 'appeals') ? this.trust.pendingCounts() : null,
      needs('kyc_reviews', 'offline_contributions', 'discrepancies')
        ? this.payments.statistics()
        : null,
      needs('organization_verifications') ? this.organizations.pendingVerifications() : 0,
      needs('rights_requests') ? this.privacy.openRequests() : 0,
      needs('failed_jobs') ? this.jobs.failedCount() : 0,
    ]);
    const counts: Record<ConsoleQueue, number> = {
      moderation_cases: trust?.cases ?? 0,
      appeals: trust?.appeals ?? 0,
      organization_verifications: verifications,
      kyc_reviews: payments?.kycPending ?? 0,
      offline_contributions: payments?.offlinePending ?? 0,
      discrepancies: payments?.discrepanciesOpen ?? 0,
      failed_jobs: failedJobs,
      rights_requests: rights,
    };
    return { items: readable.map((queue) => ({ queue, count: counts[queue] })) };
  }

  async flagList(): Promise<FeatureFlagView[]> {
    const [flags, references, locales] = await Promise.all([
      this.flags.list(),
      this.admin.legalReferences(),
      this.localization.localeStatuses(),
    ]);
    const guardOf = (key: string): FeatureFlagGuard => {
      const locale = localeOfFlag(key);
      if (locale) {
        const status = locales.find((entry) => entry.locale === locale);
        return status ? { kind: 'locale', status } : null;
      }
      const instrument = fundingInstrumentOfFlag(key);
      return instrument
        ? {
            kind: 'legal',
            legalReferenceRequired: true,
            onlinePaymentAvailable: this.payments.onlineCollectionAvailable(instrument),
          }
        : null;
    };
    return flags.map((flag) => ({
      key: flag.key,
      enabled: flag.enabled,
      description: flag.description,
      updatedAt: flag.updatedAt.toISOString(),
      legalReference: references.get(flag.key) ?? null,
      guard: guardOf(flag.key),
    }));
  }

  /** The changes of a flag, latest first, each with its author and legal reference. */
  async flagHistory(key: string): Promise<FeatureFlagChange[]> {
    if (!(await this.flags.list()).some((flag) => flag.key === key)) {
      throw new DomainError('ADMIN_FLAG_NOT_FOUND', 'Feature flag not found');
    }
    const changes = await this.admin.flagChanges(key, FILE_ITEMS * 5);
    const authors = await this.identity.findUsers(changes.map((change) => change.changedBy));
    return changes.map((change) => {
      const author = authors.get(change.changedBy);
      return {
        enabled: change.enabled,
        legalReference: change.legalReference,
        changedBy: author ? { userId: author.id, name: author.name } : null,
        changedAt: change.changedAt.toISOString(),
      };
    });
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

  /**
   * The highlights of each type in their order of display (the latest featured first), named:
   * the start of a publication, the title of a project, the name of a profile.
   */
  async highlights(type: HighlightTargetType | undefined): Promise<Highlight[]> {
    const [posts, projects, profiles] = await Promise.all([
      !type || type === 'post' ? this.content.featuredPosts(HIGHLIGHTS_LISTED) : [],
      !type || type === 'project' ? this.projects.featuredProjects(HIGHLIGHTS_LISTED) : [],
      !type || type === 'profile' ? this.profiles.featuredProfiles(HIGHLIGHTS_LISTED) : [],
    ]);
    const [postTexts, projectCards, profileIds] = await Promise.all([
      Promise.all(posts.map((row) => this.content.moderationExcerpt('post', row.id))),
      this.projects.fundables(projects.map((row) => row.id)),
      this.profiles.userIdsByHandles(profiles.map((row) => row.handle)),
    ]);
    const profileCards = await this.profiles.memberCards([...profileIds.values()]);
    const entries = [
      ...posts.map((row, index) => ({
        targetType: 'post' as const,
        targetId: row.id,
        featuredAt: row.featuredAt,
        label: excerptOf(postTexts[index]?.text ?? null),
      })),
      ...projects.map((row) => ({
        targetType: 'project' as const,
        targetId: row.id,
        featuredAt: row.featuredAt,
        label: projectCards.get(row.id)?.title ?? null,
      })),
      ...profiles.map((row) => {
        const userId = profileIds.get(row.handle);
        return {
          targetType: 'profile' as const,
          targetId: row.handle,
          featuredAt: row.featuredAt,
          label: (userId ? profileCards.get(userId)?.displayName : undefined) ?? null,
        };
      }),
    ];
    return highlightPositions(entries).map((entry) => ({
      ...entry,
      featuredAt: (entry.featuredAt ?? new Date(0)).toISOString(),
    }));
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
    const [members, projects, payments, trust, rights, failedJobs, verifications] =
      await Promise.all([
        this.identity.memberCounts(this.clock.now()),
        this.projects.countByStatus(),
        this.payments.statistics(),
        this.trust.pendingCounts(),
        this.privacy.openRequests(),
        this.jobs.failedCount(),
        this.organizations.pendingVerifications(),
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
        organizationVerifications: verifications,
        discrepancies: payments.discrepanciesOpen,
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

  /**
   * The audit log filtered as on its screen, in CSV (RFC 4180, at most AUDIT_EXPORT_MAX rows,
   * the latest first); the export is audited.
   */
  async auditExport(actorId: string, query: AuditExportQuery): Promise<string> {
    const rows = await this.audit.search(
      {
        actorId: query.actorId,
        action: query.action,
        targetType: query.targetType,
        targetId: query.targetId,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
      null,
      AUDIT_EXPORT_MAX,
    );
    await this.transactions.run(() =>
      this.audit.record({
        actor: { type: 'user', id: actorId },
        action: 'admin.audit-exported',
        target: { type: 'audit_log', id: query.targetId ?? query.actorId ?? 'all' },
        metadata: { rows: rows.length, ...query },
      }),
    );
    return auditCsv(rows);
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

/** The start of the text of a featured publication, on one line. */
function excerptOf(text: string | null): string | null {
  if (!text) return null;
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > 120 ? `${line.slice(0, 119)}…` : line;
}

import { Injectable } from '@nestjs/common';
import type {
  CursorPage,
  DeclareTimeEntryRequest,
  ImpactDashboard,
  TimeEntry,
  TimeEntryStatus,
} from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import {
  Clock,
  decodeKeyset,
  DomainError,
  encodeKeyset,
  IdGenerator,
  Money,
} from '../../../platform/kernel';
import { OutboxService } from '../../../platform/outbox';
import { PaymentsFacade } from '../../payments';
import { ProfilesFacade } from '../../profiles';
import { ProjectsFacade } from '../../projects';
import {
  TimeEntryConfirmed,
  TimeEntryDeclared,
  TimeEntryDisputed,
} from '../domain/engagement-events';
import {
  assertAnswerable,
  assertPastDate,
  monthStart,
  type TimeEntryRecord,
} from '../domain/time-entry';
import { EngagementRepository, type GiverRef } from './ports';

const REBUILD_BATCH = 500;

/** Exactly one of a project and an entrepreneur. */
export interface TimeBeneficiary {
  projectId: string | null;
  entrepreneurId: string | null;
}

const notFound = () => new DomainError('ENGAGEMENT_TIME_ENTRY_NOT_FOUND', 'Time entry not found');

/** CSV cell (RFC 4180) protected against formula injection. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
const line = (cells: readonly string[]) => `${cells.map(cell).join(',')}\r\n`;

/**
 * Impact dashboard and shared time log (sections 6.3 and 9.4). The money given is a projection
 * of the contributions of the payments module (ADR 0053), updated by its events and rebuilt by
 * replay; hours come from the declarations of this module, confirmed or disputed by their
 * beneficiary.
 */
@Injectable()
export class EngagementService {
  constructor(
    private readonly engagement: EngagementRepository,
    private readonly payments: PaymentsFacade,
    private readonly projects: ProjectsFacade,
    private readonly profiles: ProfilesFacade,
    private readonly outbox: OutboxService,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** Projects the current state of contributions, read through the facade: order-free. */
  async project(contributionIds: readonly string[]): Promise<void> {
    const now = this.clock.now();
    for (const facts of await this.payments.contributionFacts(contributionIds)) {
      await this.engagement.upsertFacts(facts, now);
    }
  }

  /** Drops the projection and replays every contribution. */
  async rebuild(): Promise<number> {
    let count = 0;
    await this.transactions.run(async () => {
      await this.engagement.deleteAllFacts();
      const now = this.clock.now();
      let after: string | null = null;
      for (;;) {
        const page = await this.payments.contributionFactsAfter(after, REBUILD_BATCH);
        for (const facts of page) await this.engagement.upsertFacts(facts, now);
        count += page.length;
        const last = page.at(-1);
        if (page.length < REBUILD_BATCH || !last) break;
        after = last.contributionId;
      }
    });
    return count;
  }

  async dashboard(giver: GiverRef): Promise<ImpactDashboard> {
    const now = this.clock.now();
    const start = monthStart(now);
    const totals = await this.engagement.totals(giver, start);
    const minutes =
      giver.type === 'member'
        ? await this.engagement.minutesByStatus(giver.id)
        : { declared: 0, confirmed: 0, disputed: 0 };
    return {
      owner: giver,
      givenThisMonth: Money.of(totals.givenThisMonthEurMinor, 'EUR').toJSON(),
      givenTotal: Money.of(totals.givenEurMinor, 'EUR').toJSON(),
      projectsSupported: totals.projectsSupported,
      minutes: {
        // Every declared minute, whatever the answer; confirmed and disputed apart.
        declared: minutes.declared + minutes.confirmed + minutes.disputed,
        confirmed: minutes.confirmed,
        disputed: minutes.disputed,
      },
      monthStart: start.toISOString(),
    };
  }

  /** Downloadable history (section 9.4): contributions, then time entries for a member. */
  async historyCsv(giver: GiverRef): Promise<string> {
    const rows = await this.engagement.factsOf(giver);
    const projects = await this.projects.fundables([...new Set(rows.map((row) => row.projectId))]);
    let csv = line(['type', 'date', 'project', 'detail', 'status', 'eur', 'minutes']);
    for (const row of rows) {
      csv += line([
        'contribution',
        (row.succeededAt ?? new Date(0)).toISOString(),
        projects.get(row.projectId)?.title ?? '',
        row.contributionId,
        row.status,
        Money.of(row.netEurMinor, 'EUR').toDecimal(),
        '',
      ]);
    }
    if (giver.type === 'member') {
      const entries = await this.engagement.timeEntries({ contributorId: giver.id }, null, 10_000);
      const entryProjects = await this.projects.fundables(
        entries.flatMap((entry) => (entry.projectId ? [entry.projectId] : [])),
      );
      for (const entry of entries) {
        csv += line([
          'time',
          entry.date,
          entry.projectId ? (entryProjects.get(entry.projectId)?.title ?? '') : '',
          entry.kind,
          entry.status,
          '',
          String(entry.minutes),
        ]);
      }
    }
    return csv;
  }

  async declare(contributorId: string, request: DeclareTimeEntryRequest): Promise<TimeEntry> {
    let beneficiary: TimeBeneficiary = { projectId: null, entrepreneurId: null };
    if (request.projectId) {
      beneficiary = { projectId: request.projectId, entrepreneurId: null };
    } else if (request.entrepreneurHandle) {
      const entrepreneurId = await this.profiles.userIdOf(
        request.entrepreneurHandle,
        contributorId,
      );
      if (!entrepreneurId) throw invalidBeneficiary();
      beneficiary = { projectId: null, entrepreneurId };
    }
    return this.view(await this.declareFor(contributorId, beneficiary, request, null));
  }

  /**
   * Declares time for a project (that the contributor does not own) or an entrepreneur (not
   * the contributor), on a day that already happened. `missionEngagementId` names the mission
   * that produced it (missions module): its own notification replaces the declared one. Joins
   * the caller's transaction.
   */
  async declareFor(
    contributorId: string,
    beneficiary: TimeBeneficiary,
    request: Pick<DeclareTimeEntryRequest, 'kind' | 'minutes' | 'date' | 'description'>,
    missionEngagementId: string | null,
  ): Promise<TimeEntryRecord> {
    const now = this.clock.now();
    assertPastDate(request.date, now);
    if (beneficiary.projectId) {
      const project = await this.projects.fundable(beneficiary.projectId);
      if (!project?.showable || project.ownerId === contributorId) throw invalidBeneficiary();
    } else if (!beneficiary.entrepreneurId || beneficiary.entrepreneurId === contributorId) {
      throw invalidBeneficiary();
    }
    const entry: TimeEntryRecord = {
      id: this.ids.next(),
      contributorId,
      projectId: beneficiary.projectId,
      entrepreneurId: beneficiary.projectId ? null : beneficiary.entrepreneurId,
      kind: request.kind,
      minutes: request.minutes,
      date: request.date,
      description: request.description,
      status: 'declared',
      respondedAt: null,
      respondedBy: null,
      disputeReason: null,
      createdAt: now,
    };
    await this.transactions.run(async () => {
      await this.engagement.insertTimeEntry(entry);
      await this.record(
        new TimeEntryDeclared({
          id: this.ids.next(),
          aggregateId: entry.id,
          occurredAt: now,
          payload: {
            contributorId,
            projectId: entry.projectId,
            entrepreneurId: entry.entrepreneurId,
            kind: entry.kind,
            minutes: entry.minutes,
            missionEngagementId,
          },
        }),
      );
    });
    return entry;
  }

  /** Time entries by id (minutes and answer), for the missions module. */
  async entries(ids: readonly string[]): Promise<Map<string, TimeEntryRecord>> {
    const found = new Map<string, TimeEntryRecord>();
    for (const id of new Set(ids)) {
      const entry = await this.engagement.findTimeEntry(id);
      if (entry) found.set(id, entry);
    }
    return found;
  }

  /** The beneficiary (the entrepreneur, or an owner of the project) confirms or disputes. */
  async respond(
    id: string,
    userId: string,
    answer: 'confirmed' | 'disputed',
    reason?: string,
  ): Promise<TimeEntry> {
    const entry = await this.transactions.run(async () => {
      const current = await this.engagement.lockTimeEntry(id);
      if (!current) throw notFound();
      assertAnswerable(current);
      const now = this.clock.now();
      const patch: Partial<TimeEntryRecord> = {
        status: answer,
        respondedAt: now,
        respondedBy: userId,
        disputeReason: answer === 'disputed' ? (reason ?? null) : null,
      };
      await this.engagement.updateTimeEntry(id, patch);
      const base = { id: this.ids.next(), aggregateId: id, occurredAt: now };
      await this.record(
        answer === 'confirmed'
          ? new TimeEntryConfirmed({
              ...base,
              payload: {
                by: userId,
                minutes: current.minutes,
                contributorId: current.contributorId,
              },
            })
          : new TimeEntryDisputed({
              ...base,
              payload: { by: userId, contributorId: current.contributorId },
            }),
      );
      return { ...current, ...patch };
    });
    return this.view(entry);
  }

  /** Whether the member answers for the beneficiary of an entry. */
  async isBeneficiary(entry: TimeEntryRecord, userId: string): Promise<boolean> {
    if (entry.entrepreneurId) return entry.entrepreneurId === userId;
    return (
      entry.projectId !== null &&
      (await this.projects.teamRoleOf(entry.projectId, userId)) === 'owner'
    );
  }

  findEntry(id: string): Promise<TimeEntryRecord | null> {
    return this.engagement.findTimeEntry(id);
  }

  async declared(
    contributorId: string,
    query: { cursor?: string | undefined; limit: number; status?: TimeEntryStatus | undefined },
  ): Promise<CursorPage<TimeEntry>> {
    return this.page(
      await this.engagement.timeEntries(
        { contributorId, ...(query.status ? { status: query.status } : {}) },
        decodeKeyset(query.cursor),
        query.limit + 1,
      ),
      query.limit,
    );
  }

  /** Entries the member answers for: as entrepreneur, or as owner of the project. */
  async received(
    userId: string,
    query: { cursor?: string | undefined; limit: number; status?: TimeEntryStatus | undefined },
  ): Promise<CursorPage<TimeEntry>> {
    const projectIds = await this.projects.ownedProjectIds(userId);
    return this.page(
      await this.engagement.timeEntries(
        { entrepreneurId: userId, projectIds, ...(query.status ? { status: query.status } : {}) },
        decodeKeyset(query.cursor),
        query.limit + 1,
      ),
      query.limit,
    );
  }

  private async page(rows: TimeEntryRecord[], limit: number): Promise<CursorPage<TimeEntry>> {
    const pageRows = rows.slice(0, limit);
    const last = pageRows.at(-1);
    return {
      items: await this.views(pageRows),
      nextCursor:
        rows.length > limit && last ? encodeKeyset({ at: last.createdAt, key: last.id }) : null,
    };
  }

  private async view(entry: TimeEntryRecord): Promise<TimeEntry> {
    const [view] = await this.views([entry]);
    if (!view) throw notFound();
    return view;
  }

  private async views(rows: readonly TimeEntryRecord[]): Promise<TimeEntry[]> {
    const [cards, projects] = await Promise.all([
      this.profiles.memberCards(
        rows.flatMap((row) => [
          row.contributorId,
          ...(row.entrepreneurId ? [row.entrepreneurId] : []),
        ]),
      ),
      this.projects.fundables(rows.flatMap((row) => (row.projectId ? [row.projectId] : []))),
    ]);
    const card = (userId: string | null) => {
      const found = userId ? cards.get(userId) : undefined;
      return found
        ? {
            handle: found.handle,
            displayName: found.displayName,
            headline: found.headline,
            avatarUrl: found.avatarUrl,
          }
        : null;
    };
    return rows.map((row) => {
      const project = row.projectId ? projects.get(row.projectId) : undefined;
      return {
        id: row.id,
        contributor: card(row.contributorId),
        project: project ? { id: project.id, slug: project.slug, title: project.title } : null,
        entrepreneur: card(row.entrepreneurId),
        kind: row.kind,
        minutes: row.minutes,
        date: row.date,
        description: row.description,
        status: row.status,
        respondedAt: row.respondedAt?.toISOString() ?? null,
        disputeReason: row.disputeReason,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  private record(event: TimeEntryDeclared | TimeEntryConfirmed | TimeEntryDisputed): Promise<void> {
    return this.outbox.record(event);
  }
}

function invalidBeneficiary(): DomainError {
  return new DomainError('ENGAGEMENT_BENEFICIARY_INVALID', 'Invalid beneficiary');
}

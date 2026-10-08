import { Injectable, Logger } from '@nestjs/common';
import { DISCOVERY_KINDS, type DiscoveryKind } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, IdGenerator } from '../../../platform/kernel';
import { OutboxService } from '../../../platform/outbox';
import { IndexDriftDetected } from '../domain/discovery-events';
import { IndexerService } from './indexer.service';
import { MatchingService } from './matching.service';
import { DiscoveryRepository } from './ports';

const BATCH = 200;

export interface DriftReport {
  checked: number;
  missing: number;
  stale: number;
  orphaned: number;
  kinds: DiscoveryKind[];
}

/**
 * Rebuild and drift check of the projection (ADR 0065). The rebuild reads every source through
 * the facades and rewrites the index, then recomputes every suggestion. The drift check
 * compares the fingerprints of the expected documents with the stored ones: a missing, stale
 * or orphaned entity is reindexed and the drift recorded (`discovery.index.drift-detected.v1`).
 */
@Injectable()
export class IndexMaintenanceService {
  private readonly logger = new Logger(IndexMaintenanceService.name);

  constructor(
    private readonly discovery: DiscoveryRepository,
    private readonly indexer: IndexerService,
    private readonly matching: MatchingService,
    private readonly outbox: OutboxService,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** Full rebuild of the index from the sources, then of the suggestions. */
  async rebuild(): Promise<{ indexed: number; removed: number; subjects: number }> {
    let indexed = 0;
    let removed = 0;
    for (const kind of DISCOVERY_KINDS) {
      for await (const ids of this.pages((after) =>
        this.indexer.sourceIdsAfter(kind, after, BATCH),
      )) {
        removed += (await this.indexer.reindex(kind, ids)).removed.length;
        indexed += ids.length;
      }
      for await (const ids of this.pages((after) =>
        this.discovery.indexedIdsAfter(kind, after, BATCH),
      )) {
        const expected = await this.indexer.expected(kind, ids);
        const orphans = ids.filter((id) => !expected.has(id));
        removed += (await this.indexer.reindex(kind, orphans)).removed.length;
      }
    }
    const subjects = await this.recomputeAll();
    return { indexed, removed, subjects };
  }

  async recomputeAll(): Promise<number> {
    let subjects = 0;
    for await (const ids of this.pages((after) =>
      this.indexer.sourceIdsAfter('person', after, BATCH),
    )) {
      for (const id of ids) await this.matching.recomputeMember(id);
      subjects += ids.length;
    }
    for await (const ids of this.pages((after) =>
      this.discovery.indexedIdsAfter('project', after, BATCH),
    )) {
      for (const id of ids) await this.matching.recomputeProject(id);
      subjects += ids.length;
    }
    return subjects;
  }

  /** Compares the projection with the sources and repairs what differs. */
  async checkDrift(repair = true): Promise<DriftReport> {
    const report: DriftReport = { checked: 0, missing: 0, stale: 0, orphaned: 0, kinds: [] };
    const drifted = new Map<DiscoveryKind, Set<string>>();
    const mark = (kind: DiscoveryKind, id: string) => {
      const set = drifted.get(kind) ?? new Set<string>();
      set.add(id);
      drifted.set(kind, set);
    };
    for (const kind of DISCOVERY_KINDS) {
      for await (const ids of this.pages((after) =>
        this.indexer.sourceIdsAfter(kind, after, BATCH),
      )) {
        const [expected, stored] = await Promise.all([
          this.indexer.expected(kind, ids),
          this.discovery.fingerprints(kind, ids),
        ]);
        report.checked += ids.length;
        for (const id of ids) {
          const documents = expected.get(id)?.documents ?? [];
          const want = IndexerService.fingerprintOf(documents);
          const have = stored.get(id) ?? '';
          if (want === have) continue;
          if (have === '') report.missing += 1;
          else if (want === '') report.orphaned += 1;
          else report.stale += 1;
          mark(kind, id);
        }
      }
      for await (const ids of this.pages((after) =>
        this.discovery.indexedIdsAfter(kind, after, BATCH),
      )) {
        const expected = await this.indexer.expected(kind, ids);
        for (const id of ids) {
          if (!expected.has(id) && !drifted.get(kind)?.has(id)) {
            report.orphaned += 1;
            mark(kind, id);
          }
        }
      }
    }
    report.kinds = [...drifted.keys()];
    if (report.kinds.length === 0) return report;
    this.logger.warn(
      `Search index drift: ${report.missing} missing, ${report.stale} stale, ${report.orphaned} orphaned`,
    );
    await this.transactions.run(() =>
      this.outbox.record(
        new IndexDriftDetected({
          id: this.ids.next(),
          aggregateId: this.ids.next(),
          occurredAt: this.clock.now(),
          payload: {
            missing: report.missing,
            stale: report.stale,
            orphaned: report.orphaned,
            kinds: report.kinds,
          },
        }),
      ),
    );
    if (repair) {
      for (const [kind, ids] of drifted) {
        await this.indexer.reindex(kind, [...ids]);
        for (const id of ids) await this.matching.candidateChanged(kind, id);
      }
    }
    return report;
  }

  private async *pages(read: (after: string | null) => Promise<string[]>) {
    let after: string | null = null;
    for (;;) {
      const ids = await read(after);
      if (ids.length > 0) yield ids;
      if (ids.length < BATCH) return;
      after = ids.at(-1) ?? null;
    }
  }
}

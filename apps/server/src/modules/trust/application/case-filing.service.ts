import { Injectable } from '@nestjs/common';
import type { ReportReason, ReportTargetType, TrustSignalKind } from '@pitchorium/contracts';
import { Clock, IdGenerator } from '../../../platform/kernel';
import { priorityOf } from '../domain/priority';
import type { CaseRecord } from '../domain/trust';
import { TrustRepository } from './ports';

export interface Filing {
  targetType: ReportTargetType;
  targetId: string;
  subjectId: string | null;
  fundingActive: boolean;
  /** A report adds its reason; a signal opens a case only when none is open. */
  source: { kind: 'report'; reason: ReportReason } | { kind: 'signal'; signal: TrustSignalKind };
}

/**
 * Files a report or a signal into the open case of its target (one open case per target),
 * creating it when needed, and recomputes its priority. Callers hold the transaction and the
 * lock of the target.
 */
@Injectable()
export class CaseFilingService {
  constructor(
    private readonly trust: TrustRepository,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async file(filing: Filing): Promise<{ record: CaseRecord; created: boolean }> {
    const now = this.clock.now();
    const existing = await this.trust.openCaseFor(filing.targetType, filing.targetId);
    if (existing) {
      if (filing.source.kind === 'signal') return { record: existing, created: false };
      const reasons = [...new Set([...existing.reasons, filing.source.reason])];
      const reportCount = existing.reportCount + 1;
      const fundingActive = existing.fundingActive || filing.fundingActive;
      const priority = priorityOf({
        targetType: existing.targetType,
        origin: existing.origin,
        reasons,
        reportCount,
        fundingActive,
      });
      const patch = {
        reasons,
        reportCount,
        fundingActive,
        priority: priority.priority,
        priorityReasons: priority.reasons,
        subjectId: existing.subjectId ?? filing.subjectId,
        updatedAt: now,
      };
      await this.trust.updateCase(existing.id, patch);
      return { record: { ...existing, ...patch }, created: false };
    }
    const report = filing.source.kind === 'report';
    const reasons = report && filing.source.kind === 'report' ? [filing.source.reason] : [];
    const priority = priorityOf({
      targetType: filing.targetType,
      origin: report ? 'report' : 'signal',
      reasons,
      reportCount: report ? 1 : 0,
      fundingActive: filing.fundingActive,
    });
    const record: CaseRecord = {
      id: this.ids.next(),
      targetType: filing.targetType,
      targetId: filing.targetId,
      subjectId: filing.subjectId,
      origin: report ? 'report' : 'signal',
      signalKind: filing.source.kind === 'signal' ? filing.source.signal : null,
      status: 'open',
      priority: priority.priority,
      priorityReasons:
        filing.source.kind === 'signal'
          ? [...priority.reasons, `signal:${filing.source.signal}`]
          : priority.reasons,
      reportCount: report ? 1 : 0,
      reasons,
      fundingActive: filing.fundingActive,
      assignedTo: null,
      decisionId: null,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
    };
    await this.trust.insertCase(record);
    return { record, created: true };
  }
}

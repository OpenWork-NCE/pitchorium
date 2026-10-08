import { Injectable } from '@nestjs/common';
import type {
  AnonymousReportRequest,
  CreateReportRequest,
  CursorPage,
  CursorPageQuery,
  Locale,
  Report,
  ReportReceipt,
  ReportReason,
} from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import {
  Clock,
  decodeKeyset,
  DomainError,
  encodeKeyset,
  IdGenerator,
} from '../../../platform/kernel';
import { Metrics } from '../../../platform/observability';
import { ReportCreated } from '../domain/trust-events';
import type { ReportRecord } from '../domain/trust';
import { CaseFilingService } from './case-filing.service';
import { TrustRepository } from './ports';
import { SignalsService } from './signals.service';
import { TargetDirectory } from './target-directory';
import { TrustEventsRecorder } from './trust-events.recorder';
import { reportView } from './trust-views';

interface Reporter {
  id: string | null;
  name: string | null;
  email: string | null;
  locale: Locale | null;
}

/**
 * Notice and action (§13): reports of members, notices of illegal content without an
 * account. Each report joins the open case of its target (deduplication), is acknowledged, and
 * its author is told the outcome of the decision.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly trust: TrustRepository,
    private readonly targets: TargetDirectory,
    private readonly filing: CaseFilingService,
    private readonly signals: SignalsService,
    private readonly events: TrustEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly metrics: Metrics,
  ) {}

  async report(reporterId: string, request: CreateReportRequest): Promise<Report> {
    const record = await this.file(
      request.targetType,
      request.targetId,
      request.reason,
      request.details,
      { id: reporterId, name: null, email: null, locale: null },
    );
    return reportView(record, await this.targets.handles([record.targetId], reporterId));
  }

  /** Notice of illegal content without an account (rate limited by the route). */
  async notice(request: AnonymousReportRequest): Promise<ReportReceipt> {
    const record = await this.file(
      request.targetType,
      request.targetId,
      'illegal_content',
      request.details,
      {
        id: null,
        name: request.reporterName,
        email: request.reporterEmail,
        locale: request.reporterEmail ? request.locale : null,
      },
    );
    return { id: record.id, receivedAt: record.createdAt.toISOString() };
  }

  async mine(reporterId: string, query: CursorPageQuery): Promise<CursorPage<Report>> {
    const rows = await this.trust.reportsBy(
      reporterId,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const profiles = page.filter((row) => row.targetType === 'profile').map((row) => row.targetId);
    const handles = await this.targets.handles(profiles, reporterId);
    return {
      items: page.map((row) => reportView(row, handles)),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.createdAt, key: last.id })
          : null,
    };
  }

  private async file(
    targetType: CreateReportRequest['targetType'],
    rawTargetId: string,
    reason: ReportReason,
    details: string | null,
    reporter: Reporter,
  ): Promise<ReportRecord> {
    const target = await this.targets.resolve(targetType, rawTargetId, reporter.id);
    if (!target) throw new DomainError('TRUST_TARGET_NOT_FOUND', 'Reported content not found');
    if (reporter.id && target.subjectId === reporter.id) {
      throw new DomainError('TRUST_SELF_REPORT', 'Own content cannot be reported');
    }
    const record = await this.transactions.run(async () => {
      await this.trust.lockTarget(targetType, target.targetId);
      const open = await this.trust.openCaseFor(targetType, target.targetId);
      if (open && reporter.id && (await this.trust.hasReported(open.id, reporter.id))) {
        throw new DomainError('TRUST_REPORT_DUPLICATE', 'Content already reported');
      }
      const { record: filed } = await this.filing.file({
        targetType,
        targetId: target.targetId,
        subjectId: target.subjectId,
        fundingActive: target.fundingActive,
        source: { kind: 'report', reason },
      });
      const report: ReportRecord = {
        id: this.ids.next(),
        caseId: filed.id,
        targetType,
        targetId: target.targetId,
        reason,
        details,
        reporterId: reporter.id,
        reporterName: reporter.name,
        reporterEmail: reporter.email,
        reporterLocale: reporter.locale,
        messageContext: target.messageContext
          ? {
              conversationId: target.messageContext.conversationId,
              messages: target.messageContext.messages.map((message) => ({
                ...message,
                sentAt: message.sentAt.toISOString(),
              })),
            }
          : null,
        outcome: null,
        createdAt: this.clock.now(),
        resolvedAt: null,
      };
      await this.trust.insertReport(report);
      await this.events.record(ReportCreated, report.id, {
        caseId: filed.id,
        targetType,
        reason,
        reporterId: reporter.id,
      });
      if (target.subjectId) await this.signals.reportReceived(target.subjectId);
      return report;
    });
    this.metrics.increment('pitchorium.trust.report.created', {
      targetType,
      reason,
      anonymous: String(reporter.id === null),
    });
    return record;
  }
}

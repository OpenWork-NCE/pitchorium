import { Inject, Injectable } from '@nestjs/common';
import type {
  CursorPage,
  DataExport,
  DataExportDownload,
  ErasureRequest,
  PrivacyOverview,
  RightsRequest,
  RightsRequestQuery,
} from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import {
  Clock,
  decodeKeyset,
  DomainError,
  encodeKeyset,
  IdGenerator,
} from '../../../platform/kernel';
import { ObjectStorage } from '../../../platform/storage';
import { cancelable, erasureDate, exportAllowed, nextExportAt } from '../domain/privacy';
import { ErasureCanceled, ErasureRequested, ExportRequested } from '../domain/privacy-events';
import { type ErasureBlocker, PersonalDataRegistry } from './personal-data';
import { PrivacyEventsRecorder } from './privacy-events.recorder';
import { erasureView, exportView, rightsRequestView } from './privacy-views';
import { PrivacyRepository } from './ports';

const LISTED_EXPORTS = 5;

/**
 * Rights requests of a member (GDPR articles 15, 17 and 20): an export at a time, built by the
 * worker; an erasure after a cancelable grace period, refused while a rule blocks it. The
 * administrators follow every request and its legal deadline.
 */
@Injectable()
export class PrivacyRequestsService {
  constructor(
    private readonly privacy: PrivacyRepository,
    private readonly registry: PersonalDataRegistry,
    private readonly storage: ObjectStorage,
    private readonly events: PrivacyEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly audit: AuditService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  async overview(userId: string): Promise<PrivacyOverview> {
    const [exports, latest, erasure, blockers] = await Promise.all([
      this.privacy.exportsOf(userId, LISTED_EXPORTS),
      this.privacy.latestExport(userId),
      this.privacy.latestErasureOf(userId),
      this.blockers(userId),
    ]);
    const next = nextExportAt(latest, this.clock.now(), this.config.privacy.exportMinIntervalMs);
    return {
      exports: exports.map(exportView),
      nextExportAt: next ? next.toISOString() : null,
      erasure:
        erasure && erasure.status !== 'canceled'
          ? erasureView(erasure, this.config.privacy.erasureReminderMs)
          : null,
      erasureBlockers: blockers.map(({ code, resource }) => ({ code, resource })),
    };
  }

  requestExport(userId: string): Promise<DataExport> {
    return this.transactions.run(async () => {
      const now = this.clock.now();
      const latest = await this.privacy.latestExport(userId);
      if (!exportAllowed(latest, now, this.config.privacy.exportMinIntervalMs)) {
        throw new DomainError('PRIVACY_EXPORT_RATE_LIMITED', 'An export was requested recently');
      }
      const record = {
        id: this.ids.next(),
        userId,
        status: 'pending' as const,
        storageKey: null,
        sizeBytes: null,
        error: null,
        requestedAt: now,
        completedAt: null,
        expiresAt: null,
      };
      await this.privacy.insertExport(record);
      await this.events.record(ExportRequested, record.id, { userId });
      return exportView(record);
    });
  }

  async download(userId: string, exportId: string): Promise<DataExportDownload> {
    const found = await this.privacy.findExport(exportId);
    if (!found || found.userId !== userId) {
      throw new DomainError('PRIVACY_EXPORT_NOT_FOUND', 'Export not found');
    }
    if (found.status !== 'ready' || !found.storageKey) {
      throw new DomainError('PRIVACY_EXPORT_NOT_READY', 'Export not ready or expired');
    }
    const url = await this.storage.createDownloadUrl({
      visibility: 'private',
      key: found.storageKey,
      expiresInSeconds: this.config.privacy.exportUrlTtlSeconds,
    });
    return { url: url.url, expiresAt: url.expiresAt.toISOString() };
  }

  async requestErasure(userId: string): Promise<ErasureRequest> {
    await this.assertNotBlocked(userId);
    return this.transactions.run(async () => {
      if (await this.privacy.openErasureOf(userId)) {
        throw new DomainError('PRIVACY_ERASURE_PENDING', 'An erasure is already scheduled');
      }
      const now = this.clock.now();
      const record = {
        id: this.ids.next(),
        userId,
        status: 'scheduled' as const,
        pseudonym: null,
        contact: null,
        progress: [],
        blockedBy: null,
        residues: null,
        requestedAt: now,
        scheduledFor: erasureDate(now, this.config.privacy.erasureGraceMs / 86_400_000),
        remindedAt: null,
        canceledAt: null,
        startedAt: null,
        completedAt: null,
      };
      await this.privacy.insertErasure(record);
      await this.events.record(ErasureRequested, record.id, {
        userId,
        scheduledFor: record.scheduledFor.toISOString(),
      });
      await this.audit.record({
        actor: { type: 'user', id: userId },
        action: 'privacy.erasure-requested',
        target: { type: 'erasure', id: record.id },
        metadata: { scheduledFor: record.scheduledFor.toISOString() },
      });
      return erasureView(record, this.config.privacy.erasureReminderMs);
    });
  }

  cancelErasure(userId: string): Promise<ErasureRequest> {
    return this.transactions.run(async () => {
      const open = await this.privacy.openErasureOf(userId);
      const found = open ? await this.privacy.lockErasure(open.id) : null;
      if (!found || !cancelable(found)) {
        throw new DomainError('PRIVACY_ERASURE_NOT_FOUND', 'No erasure to cancel');
      }
      const now = this.clock.now();
      await this.privacy.updateErasure(found.id, { status: 'canceled', canceledAt: now });
      await this.events.record(ErasureCanceled, found.id, { userId });
      await this.audit.record({
        actor: { type: 'user', id: userId },
        action: 'privacy.erasure-canceled',
        target: { type: 'erasure', id: found.id },
      });
      return erasureView(
        { ...found, status: 'canceled', canceledAt: now },
        this.config.privacy.erasureReminderMs,
      );
    });
  }

  async rightsRequests(query: RightsRequestQuery): Promise<CursorPage<RightsRequest>> {
    const rows = await this.privacy.rightsRequests(
      query.kind,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const now = this.clock.now();
    return {
      items: page.map((row) => rightsRequestView(row, now)),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.requestedAt, key: last.id })
          : null,
    };
  }

  /** Every rule that blocks the erasure now, module by module. */
  private async blockers(userId: string): Promise<ErasureBlocker[]> {
    const found: ErasureBlocker[] = [];
    for (const registration of this.registry.all()) {
      found.push(...((await registration.eraser.blockers?.(userId)) ?? []));
    }
    return found;
  }

  /** The first rule that blocks the erasure, answered with its stable code. */
  private async assertNotBlocked(userId: string): Promise<void> {
    for (const registration of this.registry.all()) {
      const [blocker] = (await registration.eraser.blockers?.(userId)) ?? [];
      if (blocker) {
        throw new DomainError(
          blocker.code,
          blocker.code === 'PRIVACY_CAMPAIGN_IN_PROGRESS'
            ? 'A campaign of the member is collecting contributions: wait until it closes'
            : 'Transfer the ownership of the organization first',
        );
      }
    }
  }
}

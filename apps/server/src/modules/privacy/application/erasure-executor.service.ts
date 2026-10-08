import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { renderPlatformNoticeEmail } from '@pitchorium/emails';
import { AuditService } from '../../../platform/audit';
import { ResidueScanner } from '../../../platform/compliance';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { Mailer } from '../../../platform/mailer';
import { Metrics } from '../../../platform/observability';
import { erasureDue, type ErasureRecord, reminderDue } from '../domain/privacy';
import { ErasureExecuted, ErasureReminderDue } from '../domain/privacy-events';
import { PersonalDataRegistry } from './personal-data';
import { PrivacyEventsRecorder } from './privacy-events.recorder';
import { PrivacyRepository } from './ports';

/**
 * Tables where the identifier of an erased member may remain, each with its own short
 * retention (docs/compliance/retention.md): the outbox (OUTBOX_RETENTION_DAYS), the idempotent
 * answers (IDEMPOTENCY_TTL_HOURS), and the erasure request itself until it completes.
 */
export const ALLOWED_RESIDUES: readonly string[] = [
  'platform.outbox_events',
  'platform.idempotency_keys',
  'privacy.erasures',
];

const BATCH = 20;

/**
 * Executes the erasures due after their grace period (worker): the erasers of every module in
 * order, each in its own transaction and recorded in the progress (resumable, idempotent), the
 * audit log pseudonymized, then the residue check over every schema. A residue fails the
 * request; otherwise the former member gets a confirmation and the request forgets them.
 */
@Injectable()
export class ErasureExecutorService {
  private readonly logger = new Logger(ErasureExecutorService.name);

  constructor(
    private readonly privacy: PrivacyRepository,
    private readonly registry: PersonalDataRegistry,
    private readonly residues: ResidueScanner,
    private readonly audit: AuditService,
    private readonly mailer: Mailer,
    private readonly events: PrivacyEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
    private readonly metrics: Metrics,
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
  ) {}

  async runDue(): Promise<number> {
    const due = await this.privacy.dueErasures(this.clock.now(), BATCH);
    for (const erasure of due) {
      try {
        await this.execute(erasure.id);
      } catch (error) {
        this.logger.error(`Erasure ${erasure.id} interrupted: ${String(error)}`);
      }
    }
    return due.length;
  }

  async remind(): Promise<number> {
    const now = this.clock.now();
    const before = new Date(now.getTime() + this.config.privacy.erasureReminderMs);
    const due = await this.privacy.erasuresToRemind(before, 100);
    for (const erasure of due) {
      if (!erasure.userId) continue;
      if (!reminderDue(erasure, now, this.config.privacy.erasureReminderMs / 86_400_000)) continue;
      await this.transactions.run(async () => {
        await this.privacy.updateErasure(erasure.id, { remindedAt: now });
        await this.events.record(ErasureReminderDue, erasure.id, {
          userId: erasure.userId!,
          scheduledFor: erasure.scheduledFor.toISOString(),
        });
      });
    }
    return due.length;
  }

  async execute(erasureId: string): Promise<ErasureRecord | null> {
    const started = await this.start(erasureId);
    if (!started?.userId || !started.pseudonym || !started.contact) return started;
    const context = {
      userId: started.userId,
      email: started.contact.email,
      pseudonym: started.pseudonym,
      at: started.startedAt ?? this.clock.now(),
    };
    const progress = new Set(started.progress);
    for (const registration of this.registry.all()) {
      if (progress.has(registration.module)) continue;
      await this.transactions.run(async () => {
        await registration.eraser.erase(context);
        progress.add(registration.module);
        await this.privacy.updateErasure(erasureId, { progress: [...progress] });
      });
    }
    await this.transactions.run(() =>
      this.audit.pseudonymize(context.userId, context.email, context.pseudonym),
    );
    const residues = await this.residues.scan([context.userId, context.email], ALLOWED_RESIDUES);
    if (residues.length > 0) {
      await this.privacy.updateErasure(erasureId, { status: 'failed', residues });
      this.metrics.increment('pitchorium.privacy.erasure.residue');
      this.logger.error(`Erasure ${erasureId} left residues in ${residues.join(', ')}`);
      return this.privacy.findErasure(erasureId);
    }
    await this.confirm(started);
    await this.transactions.run(async () => {
      // The request forgets the member: no identifier, no contact, no pseudonym.
      await this.privacy.updateErasure(erasureId, {
        status: 'completed',
        userId: null,
        contact: null,
        pseudonym: null,
        completedAt: this.clock.now(),
      });
      await this.events.record(ErasureExecuted, erasureId, { modules: [...progress] });
    });
    this.metrics.increment('pitchorium.privacy.erasure.completed');
    return this.privacy.findErasure(erasureId);
  }

  /** Due, not blocked: running with its pseudonym and the contact of the confirmation. */
  private async start(erasureId: string): Promise<ErasureRecord | null> {
    return this.transactions.run(async () => {
      const found = await this.privacy.lockErasure(erasureId);
      if (!found?.userId || !erasureDue(found, this.clock.now())) return found;
      if (found.status === 'running') return found;
      for (const registration of this.registry.all()) {
        const [blocker] = (await registration.eraser.blockers?.(found.userId)) ?? [];
        if (blocker) {
          await this.privacy.updateErasure(erasureId, {
            status: 'blocked',
            blockedBy: blocker.code,
          });
          return { ...found, status: 'blocked', blockedBy: blocker.code };
        }
      }
      const contact = await this.registry.directory().contact(found.userId);
      const patch = {
        status: 'running' as const,
        // Random, never derived from the identifier: the pseudonymization is irreversible.
        pseudonym: randomUUID(),
        contact: contact ?? { email: '', name: null, locale: 'fr' as const },
        startedAt: this.clock.now(),
        blockedBy: null,
      };
      await this.privacy.updateErasure(erasureId, patch);
      return { ...found, ...patch };
    });
  }

  private async confirm(erasure: ErasureRecord): Promise<void> {
    if (!erasure.contact?.email) return;
    const { subject, html, text } = await renderPlatformNoticeEmail({
      locale: erasure.contact.locale,
      kind: 'account_erased',
      name: erasure.contact.name,
      reference: this.clock.now().toISOString().slice(0, 16).replace('T', ' '),
    });
    await this.mailer.send({ to: erasure.contact.email, subject, html, text });
  }
}

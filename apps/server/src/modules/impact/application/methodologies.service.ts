import { Inject, Injectable } from '@nestjs/common';
import type { ImpactMethodologyDraft } from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { COMMON_CONFIG, type CommonConfig } from '../../../platform/config';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { MethodologyPublished } from '../domain/impact-events';
import { assertDraft, assertPublished, type MethodologyRecord } from '../domain/methodology';
import { ImpactEventsRecorder } from './impact-events.recorder';
import { ImpactRepository } from './ports';

const notFound = () =>
  new DomainError('IMPACT_METHODOLOGY_NOT_FOUND', 'Impact methodology version not found');

/**
 * Versions of the methodology (ADR 0036), managed by administrators: draft, publication,
 * archiving. Every step is audited; at most one version is published at a time.
 */
@Injectable()
export class MethodologiesService {
  constructor(
    @Inject(COMMON_CONFIG) private readonly config: CommonConfig,
    private readonly impact: ImpactRepository,
    private readonly events: ImpactEventsRecorder,
    private readonly audit: AuditService,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  list(): Promise<MethodologyRecord[]> {
    return this.impact.listMethodologies();
  }

  async require(id: string): Promise<MethodologyRecord> {
    const methodology = await this.impact.findMethodology(id);
    if (!methodology) throw notFound();
    return methodology;
  }

  /** Null while no version is published. */
  published(): Promise<MethodologyRecord | null> {
    return this.impact.publishedMethodology();
  }

  async createDraft(actorId: string, draft: ImpactMethodologyDraft): Promise<MethodologyRecord> {
    return this.transactions.run(async () => {
      await this.impact.lockMethodologies();
      const methodology = await this.insert(draft, actorId, false);
      await this.record(actorId, 'impact.methodology-drafted', methodology);
      return methodology;
    });
  }

  async updateDraft(
    actorId: string,
    id: string,
    draft: ImpactMethodologyDraft,
  ): Promise<MethodologyRecord> {
    await this.transactions.run(async () => {
      await this.impact.lockMethodologies();
      const methodology = await this.require(id);
      assertDraft(methodology);
      await this.impact.updateDraft(id, draft, this.clock.now());
      await this.record(actorId, 'impact.methodology-updated', methodology);
    });
    return this.require(id);
  }

  async deleteDraft(actorId: string, id: string): Promise<void> {
    await this.transactions.run(async () => {
      await this.impact.lockMethodologies();
      const methodology = await this.require(id);
      assertDraft(methodology);
      await this.impact.deleteDraft(id);
      await this.record(actorId, 'impact.methodology-deleted', methodology);
    });
  }

  /** The draft becomes the published version; the previous one is archived. */
  async publish(actorId: string | null, id: string): Promise<MethodologyRecord> {
    await this.transactions.run(async () => {
      await this.impact.lockMethodologies();
      const methodology = await this.require(id);
      assertDraft(methodology);
      if (methodology.demo && this.config.env === 'production') throw demoRefused();
      const now = this.clock.now();
      const previous = await this.impact.publishedMethodology();
      if (previous) await this.impact.setStatus(previous.id, 'archived', now);
      await this.impact.setStatus(id, 'published', now);
      await this.events.record(MethodologyPublished, id, {
        version: methodology.version,
        demo: methodology.demo,
        replacedVersion: previous?.version ?? null,
      });
      await this.record(actorId, 'impact.methodology-published', methodology, {
        replacedVersion: previous?.version ?? null,
      });
    });
    return this.require(id);
  }

  /** Withdraws the published version: assessments become unavailable until a new one. */
  async archive(actorId: string, id: string): Promise<MethodologyRecord> {
    await this.transactions.run(async () => {
      await this.impact.lockMethodologies();
      const methodology = await this.require(id);
      assertPublished(methodology);
      await this.impact.setStatus(id, 'archived', this.clock.now());
      await this.record(actorId, 'impact.methodology-archived', methodology);
    });
    return this.require(id);
  }

  /**
   * Fictitious methodology of `pnpm db:seed:dev`, named and labelled « DEMO, non contractuelle »:
   * no route creates one, and it is refused in production. Idempotent: an existing demo version
   * is returned as it is.
   */
  async ensureDemo(draft: ImpactMethodologyDraft): Promise<MethodologyRecord> {
    if (this.config.env === 'production') throw demoRefused();
    const existing = await this.impact.findDemoMethodology();
    if (existing) return existing;
    const created = await this.transactions.run(async () => {
      await this.impact.lockMethodologies();
      const methodology = await this.insert(draft, null, true);
      await this.record(null, 'impact.methodology-drafted', methodology);
      return methodology;
    });
    return this.publish(null, created.id);
  }

  private async insert(
    draft: ImpactMethodologyDraft,
    actorId: string | null,
    demo: boolean,
  ): Promise<MethodologyRecord> {
    const now = this.clock.now();
    const methodology: MethodologyRecord = {
      id: this.ids.next(),
      version: await this.impact.nextVersion(),
      name: draft.name,
      status: 'draft',
      demo,
      criteria: draft.criteria,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
      archivedAt: null,
    };
    await this.impact.insertMethodology(methodology);
    return methodology;
  }

  private record(
    actorId: string | null,
    action: string,
    methodology: MethodologyRecord,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    return this.audit.record({
      actor: actorId ? { type: 'user', id: actorId } : { type: 'system' },
      action,
      target: { type: 'impact_methodology', id: methodology.id },
      metadata: { version: methodology.version, demo: methodology.demo, ...metadata },
    });
  }
}

function demoRefused(): DomainError {
  return new DomainError('IMPACT_DEMO_REFUSED', 'The demonstration methodology is refused');
}

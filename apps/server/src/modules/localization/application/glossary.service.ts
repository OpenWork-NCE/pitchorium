import { Injectable } from '@nestjs/common';
import type { GlossaryTerm, UpsertGlossaryTermRequest } from '@pitchorium/contracts';
import { AuditService } from '../../../platform/audit';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { type GlossaryTermRecord, LocalizationRepository } from './ports';

/**
 * Business terms of §8.2 and §11, with provisional English translations: to be validated by
 * the professional reviewer of the English version (docs/open-questions.md, question 23).
 */
export const DEFAULT_GLOSSARY: readonly { fr: string; en: string; note: string | null }[] = [
  { fr: 'palier', en: 'tier', note: 'Cumulative funding threshold of a campaign' },
  { fr: 'mécène', en: 'patron', note: null },
  { fr: 'mécénat de compétences', en: 'skills-based volunteering', note: null },
  { fr: 'love money', en: 'love money', note: 'Kept in English in French too' },
  { fr: 'contrepartie', en: 'reward', note: 'Of a crowdfunding contribution' },
  { fr: 'porteur de projet', en: 'project holder', note: null },
  { fr: 'equity', en: 'equity', note: 'Shown as an intention only (§9.1)' },
  { fr: 'financement participatif', en: 'crowdfunding', note: null },
  { fr: 'diaspora', en: 'diaspora', note: null },
];

const view = (term: GlossaryTermRecord): GlossaryTerm => ({
  id: term.id,
  fr: term.fr,
  en: term.en,
  provisional: term.provisional,
  note: term.note,
  updatedAt: term.updatedAt.toISOString(),
});

/** The business glossary, stored as data and sent to the provider when it supports it. */
@Injectable()
export class GlossaryService {
  constructor(
    private readonly localization: LocalizationRepository,
    private readonly transactions: TransactionManager,
    private readonly audit: AuditService,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async list(): Promise<GlossaryTerm[]> {
    return (await this.localization.glossary()).map(view);
  }

  /** Inserts the default terms that are missing, never changes an existing one (worker start). */
  async ensureDefaults(): Promise<number> {
    let inserted = 0;
    for (const term of DEFAULT_GLOSSARY) {
      const created = await this.localization.insertTerm({
        id: this.ids.next(),
        ...term,
        provisional: true,
        updatedAt: this.clock.now(),
      });
      if (created) inserted += 1;
    }
    return inserted;
  }

  create(actorId: string, request: UpsertGlossaryTermRequest): Promise<GlossaryTerm> {
    return this.transactions.run(async () => {
      const term = { id: this.ids.next(), ...request, updatedAt: this.clock.now() };
      if (!(await this.localization.insertTerm(term))) {
        throw new DomainError('LOCALIZATION_GLOSSARY_TERM_EXISTS', 'Glossary term already exists');
      }
      await this.record(actorId, 'localization.glossary-term-created', term.id, request);
      return view(term);
    });
  }

  update(actorId: string, id: string, request: UpsertGlossaryTermRequest): Promise<GlossaryTerm> {
    return this.transactions.run(async () => {
      const found = await this.localization.findTerm(id);
      if (!found) throw notFound();
      const other = await this.localization.findTermByFr(request.fr);
      if (other && other.id !== id) {
        throw new DomainError('LOCALIZATION_GLOSSARY_TERM_EXISTS', 'Glossary term already exists');
      }
      const patch = { ...request, updatedAt: this.clock.now() };
      await this.localization.updateTerm(id, patch);
      await this.record(actorId, 'localization.glossary-term-updated', id, request);
      return view({ ...found, ...patch });
    });
  }

  delete(actorId: string, id: string): Promise<void> {
    return this.transactions.run(async () => {
      if (!(await this.localization.deleteTerm(id))) throw notFound();
      await this.record(actorId, 'localization.glossary-term-deleted', id, {});
    });
  }

  private record(actorId: string, action: string, id: string, metadata: object): Promise<void> {
    return this.audit.record({
      actor: { type: 'user', id: actorId },
      action,
      target: { type: 'glossary_term', id },
      metadata: { ...metadata },
    });
  }
}

function notFound(): DomainError {
  return new DomainError('LOCALIZATION_GLOSSARY_TERM_NOT_FOUND', 'Glossary term not found');
}

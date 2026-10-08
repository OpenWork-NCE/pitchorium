import { Injectable } from '@nestjs/common';
import type {
  CursorPage,
  DiscoveryKind,
  FeedSuggestion,
  Suggestion,
  SuggestionList,
} from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { OutboxService } from '../../../platform/outbox';
import { NetworkFacade } from '../../network';
import { SuggestionDismissed } from '../domain/discovery-events';
import { sentenceOf } from '../domain/matching';
import { CardsService } from './cards.service';
import { DiscoveryRepository, type ListName, type SubjectRef, type SuggestionRow } from './ports';
import { nextOffsetCursor, offsetOf } from './search.service';

/** Lists mixed at the end of a small feed, the best of each in turn. */
const FEED_LISTS: readonly SuggestionList[] = ['people', 'projects', 'events', 'missions'];

/**
 * Reads of the precomputed suggestions (ADR 0068): the lists of a member, the potential
 * contributors of a project for its team, the suggestions closing a small feed. Connections,
 * blocks and dismissed candidates are left out at read time; « pas intéressé » is kept.
 */
@Injectable()
export class SuggestionsService {
  constructor(
    private readonly discovery: DiscoveryRepository,
    private readonly cards: CardsService,
    private readonly network: NetworkFacade,
    private readonly outbox: OutboxService,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async list(
    viewerId: string,
    list: SuggestionList,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<CursorPage<Suggestion>> {
    return this.page({ type: 'member', id: viewerId }, list, viewerId, query);
  }

  /** Potential contributors of a project, read by its team. */
  async projectContributors(
    projectId: string,
    viewerId: string,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<CursorPage<Suggestion>> {
    return this.page({ type: 'project', id: projectId }, 'contributors', viewerId, query);
  }

  /** The best suggestions of several lists, alternated, for the end of a small feed. */
  async forFeed(
    viewerId: string,
    offset: number,
    limit: number,
  ): Promise<{ id: string; suggestion: FeedSuggestion }[]> {
    const excluded = await this.excluded(viewerId);
    const per = offset + limit;
    const lists = await Promise.all(
      FEED_LISTS.map((list) =>
        this.discovery.suggestions({ type: 'member', id: viewerId }, list, {
          dismissedBy: viewerId,
          excludedIds: excluded,
          offset: 0,
          limit: per,
        }),
      ),
    );
    const mixed: SuggestionRow[] = [];
    for (let rank = 0; mixed.length < per && lists.some((rows) => rows[rank]); rank += 1) {
      for (const rows of lists) {
        const row = rows[rank];
        if (row && mixed.length < per) mixed.push(row);
      }
    }
    const shown = mixed.slice(offset, offset + limit);
    const suggestions = await this.suggestions(shown, viewerId);
    return suggestions.map((suggestion) => ({
      id: `${suggestion.candidate.kind}:${suggestion.candidate.key}`,
      suggestion: { candidate: suggestion.candidate, sentence: suggestion.sentence },
    }));
  }

  /** « Pas intéressé » : the candidate leaves every list of the member, for good. */
  async dismiss(viewerId: string, kind: DiscoveryKind, key: string): Promise<void> {
    const document = await this.discovery.documentByKey(kind, key, 'members');
    if (!document) {
      throw new DomainError('DISCOVERY_CANDIDATE_NOT_FOUND', 'Suggestion not found');
    }
    const now = this.clock.now();
    await this.transactions.run(async () => {
      if (!(await this.discovery.addDismissal(viewerId, kind, document.entityId, now))) return;
      await this.outbox.record(
        new SuggestionDismissed({
          id: this.ids.next(),
          aggregateId: viewerId,
          occurredAt: now,
          payload: { candidateKind: kind, candidateId: document.entityId },
        }),
      );
    });
  }

  /** Undoes a dismissal: the candidate may come back at the next computation. */
  async undoDismissal(viewerId: string, kind: DiscoveryKind, key: string): Promise<void> {
    const document = await this.discovery.documentByKey(kind, key, 'members');
    if (!document || !(await this.discovery.removeDismissal(viewerId, kind, document.entityId))) {
      throw new DomainError('DISCOVERY_CANDIDATE_NOT_FOUND', 'Suggestion not found');
    }
  }

  private async page(
    subject: SubjectRef,
    list: ListName,
    viewerId: string,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<CursorPage<Suggestion>> {
    const offset = offsetOf(query.cursor);
    const rows = await this.discovery.suggestions(subject, list, {
      dismissedBy: viewerId,
      excludedIds: await this.excluded(viewerId),
      offset,
      limit: query.limit + 1,
    });
    return {
      items: await this.suggestions(rows.slice(0, query.limit), viewerId),
      nextCursor: nextOffsetCursor(offset, query.limit, rows.length),
    };
  }

  /** The member, their connections and the members on either side of a block. */
  private async excluded(viewerId: string): Promise<string[]> {
    const [connections, blocked] = await Promise.all([
      this.network.connectionIds(viewerId),
      this.network.blockedUserIds(viewerId),
    ]);
    return [viewerId, ...connections, ...blocked];
  }

  async suggestions(rows: readonly SuggestionRow[], viewerId: string): Promise<Suggestion[]> {
    const documents = await Promise.all(
      (['person', 'project', 'mission', 'event', 'organization'] as const).map((kind) =>
        this.discovery.documents(
          kind,
          rows.filter((row) => row.candidateKind === kind).map((row) => row.candidateId),
          'members',
        ),
      ),
    );
    const byKey = new Map(
      documents.flat().map((document) => [`${document.kind}:${document.entityId}`, document]),
    );
    const ordered = rows.flatMap((row) => {
      const document = byKey.get(`${row.candidateKind}:${row.candidateId}`);
      return document ? [{ row, document }] : [];
    });
    const cards = await this.cards.aligned(
      ordered.map((item) => item.document),
      viewerId,
    );
    return ordered.flatMap(({ row }, index) => {
      const card = cards[index];
      return card
        ? [
            {
              candidate: card,
              score: row.score,
              sentence: sentenceOf(row.reasons),
              reasons: row.reasons,
              rulesVersion: row.rulesVersion,
            },
          ]
        : [];
    });
  }
}

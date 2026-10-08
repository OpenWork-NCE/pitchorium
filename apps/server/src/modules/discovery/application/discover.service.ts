import { Injectable } from '@nestjs/common';
import {
  DISCOVER_SECTIONS,
  type DiscoverPage,
  type DiscoverSection,
  type DiscoverSectionPage,
} from '@pitchorium/contracts';
import { Clock } from '../../../platform/kernel';
import { NetworkFacade } from '../../network';
import { CardsService } from './cards.service';
import { DiscoveryRepository } from './ports';
import { audienceOf, nextOffsetCursor, offsetOf, type Searcher, viewerOf } from './search.service';
import { SuggestionsService } from './suggestions.service';

/**
 * Discover page (§10.6): recent projects, campaigns ending soon, suggested profiles with their
 * reason, editorial selection (projects highlighted by a moderator or an admin), upcoming
 * events, open missions. Each section is paginated for a wide grid; a visitor has no
 * suggested profiles.
 */
@Injectable()
export class DiscoverService {
  constructor(
    private readonly discovery: DiscoveryRepository,
    private readonly cards: CardsService,
    private readonly suggestions: SuggestionsService,
    private readonly network: NetworkFacade,
    private readonly clock: Clock,
  ) {}

  async page(searcher: Searcher, limit: number): Promise<DiscoverPage> {
    const sections = DISCOVER_SECTIONS.filter(
      (section) => searcher.kind === 'member' || section !== 'suggested_profiles',
    );
    return {
      sections: await Promise.all(
        sections.map((section) => this.section(section, searcher, { limit })),
      ),
    };
  }

  async section(
    section: DiscoverSection,
    searcher: Searcher,
    query: { cursor?: string | undefined; limit: number },
  ): Promise<DiscoverSectionPage> {
    if (section === 'suggested_profiles') {
      if (searcher.kind !== 'member') {
        return { section, items: [], sentences: [], nextCursor: null };
      }
      const page = await this.suggestions.list(searcher.viewerId, 'people', query);
      return {
        section,
        items: page.items.map((suggestion) => suggestion.candidate),
        sentences: page.items.map((suggestion) => suggestion.sentence),
        nextCursor: page.nextCursor,
      };
    }
    const offset = offsetOf(query.cursor);
    const documents = await this.discovery.section({
      audience: audienceOf(searcher),
      section,
      hiddenOwnerIds:
        searcher.kind === 'member' ? await this.network.blockedUserIds(searcher.viewerId) : [],
      now: this.clock.now(),
      offset,
      limit: query.limit + 1,
    });
    const items = await this.cards.cards(documents.slice(0, query.limit), viewerOf(searcher));
    return {
      section,
      items,
      sentences: items.map(() => null),
      nextCursor: nextOffsetCursor(offset, query.limit, documents.length),
    };
  }
}

import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ContentFacade } from '../../content';
import { DiscoveryRepository } from './ports';
import { SuggestionsService } from './suggestions.service';

/**
 * Public facade of the discovery module. At startup it gives content the suggestions that close
 * a small feed; the notifications module reads the new suggestions of each member.
 */
@Injectable()
export class DiscoveryFacade implements OnModuleInit {
  constructor(
    private readonly content: ContentFacade,
    private readonly suggestions: SuggestionsService,
    private readonly discovery: DiscoveryRepository,
  ) {}

  onModuleInit(): void {
    this.content.registerFeedSuggestionSource({
      suggestions: (viewerId, offset, limit) => this.suggestions.forFeed(viewerId, offset, limit),
    });
  }

  /** Members whose lists received new candidates in the window, with their number. */
  newSuggestionCounts(from: Date, to: Date): Promise<{ userId: string; count: number }[]> {
    return this.discovery.newSuggestionCounts(from, to);
  }
}

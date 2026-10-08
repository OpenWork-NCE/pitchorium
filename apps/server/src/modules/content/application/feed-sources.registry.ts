import { Injectable } from '@nestjs/common';
import type { EventCard, FeedSuggestion } from '@pitchorium/contracts';
import type { KeysetPosition } from '../../../platform/kernel';
import type { FeedEntry } from './ports';

/**
 * Events published by the members and organizations a reader follows, provided by the events
 * module and merged into the network part of the feed (`event` items).
 */
export interface EventsFeedSource {
  /** Newest publication first, strictly before the keyset position, at most `limit`. */
  entries(viewerId: string, after: KeysetPosition | null, limit: number): Promise<FeedEntry[]>;
  /** Cards of the events the reader may see, by id. */
  present(viewerId: string, ids: readonly string[]): Promise<Map<string, EventCard>>;
}

/**
 * Suggestions that complete a feed whose network produces too little (§10.3, ADR 0032),
 * provided by the discovery module (`suggestion` items), best first.
 */
export interface FeedSuggestionSource {
  suggestions(
    viewerId: string,
    offset: number,
    limit: number,
  ): Promise<{ id: string; suggestion: FeedSuggestion }[]>;
}

/** Extension points of the feed filled by the events and discovery modules at startup. */
@Injectable()
export class FeedSourcesRegistry {
  private events: EventsFeedSource | undefined;
  private suggestionSource: FeedSuggestionSource | undefined;

  registerEvents(source: EventsFeedSource): void {
    if (this.events) throw new Error('An events feed source is already registered');
    this.events = source;
  }

  registerSuggestions(source: FeedSuggestionSource): void {
    if (this.suggestionSource) throw new Error('A feed suggestion source is already registered');
    this.suggestionSource = source;
  }

  eventEntries(viewerId: string, after: KeysetPosition | null, limit: number) {
    return this.events ? this.events.entries(viewerId, after, limit) : Promise.resolve([]);
  }

  async presentEvents(viewerId: string, ids: readonly string[]): Promise<Map<string, EventCard>> {
    return this.events && ids.length > 0 ? this.events.present(viewerId, ids) : new Map();
  }

  suggestions(viewerId: string, offset: number, limit: number) {
    return this.suggestionSource
      ? this.suggestionSource.suggestions(viewerId, offset, limit)
      : Promise.resolve([]);
  }
}

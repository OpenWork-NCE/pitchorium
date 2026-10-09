import type { FeedPage, Suggestion } from '@pitchorium/contracts';
import { chunk } from '@/lib/collections/interleave';
import { FEED_MODULES } from '../lib/feed-items';
import { FeedList } from './feed/feed-list';

/**
 * The feed of the member space (§10.3): its first page read by the server, the suggestions of
 * people three by three among its items on a narrow screen, then the virtualized list
 * (FeedList, ADR 0121).
 */
export function FeedStream({
  initialPage,
  suggestions,
}: {
  /** First page, read by the server; null if the api could not answer (read by the browser). */
  initialPage: FeedPage | null;
  /** People suggested to the member, shown among the items on a narrow screen. */
  suggestions: readonly Suggestion[];
}) {
  const modules = chunk(
    suggestions.filter((suggestion) => suggestion.candidate.kind === 'person'),
    FEED_MODULES.suggestions,
  );
  return <FeedList initialPage={initialPage} modules={modules} />;
}

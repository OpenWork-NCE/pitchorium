import type { DiscoveryCard, SuggestionSentence } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { Card, Heading } from '@/components/ui';
import { SuggestionItem } from './suggestion-item';
import { useSuggestionReason } from './use-suggestion-reason';

interface Suggested {
  candidate: DiscoveryCard;
  sentence: SuggestionSentence;
}

/**
 * « Personnes pertinentes pour vous » (§10.2): a few people suggested, each with its reason. In
 * the right column of a wide screen, and among the items of the feed on a narrow one.
 */
export function SuggestionsList({
  suggestions,
  headingLevel = 2,
  className,
}: {
  suggestions: readonly Suggested[];
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const t = useTranslations('web.feed');
  const reason = useSuggestionReason();
  const people = suggestions.flatMap((suggestion) =>
    suggestion.candidate.kind === 'person'
      ? [{ person: suggestion.candidate, reason: reason(suggestion.sentence) }]
      : [],
  );
  if (people.length === 0) return null;
  return (
    <Card padding="sm" className={className}>
      <section className="grid gap-4" aria-label={t('suggestions')}>
        <Heading level={headingLevel} size="label">
          {t('suggestions')}
        </Heading>
        <ul className="grid gap-4">
          {people.map(({ person, reason: text }) => (
            <SuggestionItem key={person.key} person={person} reason={text} />
          ))}
        </ul>
      </section>
    </Card>
  );
}

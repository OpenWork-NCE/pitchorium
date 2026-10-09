'use client';

import type { DiscoveryCard, SuggestionSentence } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, Heading } from '@/components/ui';
import { SuggestionActions } from './suggestion-actions';
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
  title,
  headingLevel = 2,
  className,
}: {
  suggestions: readonly Suggested[];
  /** The heading of the list, « Personnes pertinentes pour vous » unless said otherwise. */
  title?: string;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const t = useTranslations('web.feed');
  const reason = useSuggestionReason();
  // Suggestions marked « Pas intéressé » leave the list at once, back if undone.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string, hide: boolean) =>
    setHidden((current) => {
      const next = new Set(current);
      if (hide) next.add(key);
      else next.delete(key);
      return next;
    });
  const people = suggestions.flatMap((suggestion) =>
    suggestion.candidate.kind === 'person' && !hidden.has(suggestion.candidate.key)
      ? [{ person: suggestion.candidate, reason: reason(suggestion.sentence) }]
      : [],
  );
  if (people.length === 0) return null;
  const heading = title ?? t('suggestions');
  return (
    <Card padding="sm" className={className}>
      <section className="grid gap-4" aria-label={heading}>
        <Heading level={headingLevel} size="label">
          {heading}
        </Heading>
        <ul className="grid gap-4">
          {people.map(({ person, reason: text }) => (
            <SuggestionItem
              key={person.key}
              person={person}
              reason={text}
              actions={
                <SuggestionActions
                  candidate={person}
                  onDismissed={() => toggle(person.key, true)}
                  onRestored={() => toggle(person.key, false)}
                />
              }
            />
          ))}
        </ul>
      </section>
    </Card>
  );
}

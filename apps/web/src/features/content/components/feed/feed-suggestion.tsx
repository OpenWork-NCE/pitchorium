'use client';

import type { FeedSuggestion as FeedSuggestionData, Suggestion } from '@pitchorium/contracts';
import { Building2, Rocket } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ComponentProps } from 'react';
import { Card, Heading } from '@/components/ui';
import { SuggestionsList, useSuggestionReason } from '@/features/discovery';
import { routes } from '@/config/routes';
import { Link } from '@/i18n/navigation';

type Position = Omit<ComponentProps<'article'>, 'children'>;

const focusRing = 'rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-focus';

/** People suggested among the items of a narrow feed, as an article of the feed. */
export function SuggestionModule({
  suggestions,
  ...position
}: { suggestions: readonly Suggestion[] } & Position) {
  const t = useTranslations('web.feed');
  return (
    <article aria-label={t('suggestions')} className={focusRing} {...position}>
      <SuggestionsList suggestions={suggestions} headingLevel={2} />
    </article>
  );
}

/**
 * A suggestion closing a feed whose network gives too little (ADR 0032): a person with « Se
 * connecter », an organization with the way to its page, a project without it until its page is
 * delivered (PROMPT FRONT 5A); each with its reason.
 */
export function FeedSuggestion({
  suggestion,
  ...position
}: { suggestion: FeedSuggestionData } & Position) {
  const t = useTranslations('web.feed');
  const reason = useSuggestionReason();
  const { candidate } = suggestion;
  if (candidate.kind === 'person') {
    return (
      <article aria-label={t('suggestionsLabel')} className={focusRing} {...position}>
        <SuggestionsList
          suggestions={[suggestion]}
          title={t('suggestionsLabel')}
          headingLevel={2}
        />
      </article>
    );
  }
  if (candidate.kind !== 'organization' && candidate.kind !== 'project') return null;
  const Icon = candidate.kind === 'organization' ? Building2 : Rocket;
  return (
    <article aria-label={t('suggestionsLabel')} className={focusRing} {...position}>
      <Card padding="sm" className="grid gap-2">
        <Heading level={2} size="label">
          {t('suggestionsLabel')}
        </Heading>
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-sunken">
            <Icon aria-hidden className="size-5 text-muted" />
          </span>
          <div className="grid min-w-0 gap-0.5">
            {candidate.kind === 'organization' ? (
              <Link
                href={routes.organization(candidate.key)}
                prefetch={false}
                className="w-fit truncate text-sm font-semibold hover:underline"
              >
                {candidate.title}
              </Link>
            ) : (
              <p className="truncate text-sm font-semibold">{candidate.title}</p>
            )}
            {candidate.subtitle ? (
              <p className="truncate text-xs text-muted">{candidate.subtitle}</p>
            ) : null}
            <p className="text-xs text-pretty text-muted">{reason(suggestion.sentence)}</p>
          </div>
        </div>
      </Card>
    </article>
  );
}

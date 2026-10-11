import type { DiscoverSectionPage } from '@pitchorium/contracts';
import { suggestionSentenceText } from '@pitchorium/i18n';
import { ArrowRight, Compass } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button, EmptyState, Heading, Text } from '@/components/ui';
import { Reveal } from '@/components/motion';
import * as routes from '@/config/paths';
import { Link } from '@/i18n/navigation';
import type { DiscoverSection } from '../lib/kinds';
import { ResultCard, ResultGrid } from './result-card';
import { DismissibleItem, SuggestedProfileActions } from './suggested-profile-actions';

/** Where the empty state of a section sends: the page that fills it, and its label. */
const EMPTY_ACTIONS: Partial<
  Record<DiscoverSection, readonly [string, 'projects' | 'events' | 'missions']>
> = {
  recent_projects: [routes.projects, 'projects'],
  ending_soon_projects: [routes.projects, 'projects'],
  editorial: [routes.projects, 'projects'],
  upcoming_events: [routes.events, 'events'],
  open_missions: [routes.missions, 'missions'],
};

/**
 * One section of « Découvrir » (§10.6): its title, a wide grid of cards (never a carousel), the
 * reason of a suggested profile with « Se connecter », the way to its full page, and its own empty
 * state.
 */
export async function DiscoverSectionGrid({
  page,
  signedIn,
  full = false,
}: {
  page: DiscoverSectionPage;
  signedIn: boolean;
  /** On the page of the section: no title link, the heading is the page's. */
  full?: boolean;
}) {
  const t = await getTranslations('web.discover');
  const locale = await getLocale();
  const section = page.section;
  const empty = EMPTY_ACTIONS[section];
  if (page.items.length === 0) {
    return (
      <EmptyState
        size="inline"
        headingLevel={3}
        icon={<Compass />}
        title={t(`sections.${section}.empty`)}
        description={t(`sections.${section}.emptyBody`)}
        action={
          empty ? (
            <Button asChild variant="outline" size="sm">
              <Link href={empty[0]}>{t(`emptyActions.${empty[1]}`)}</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }
  return (
    <ResultGrid wide>
      {page.items.map((card, index) => {
        const sentence = page.sentences[index];
        const id = `${card.kind}:${card.key}`;
        const suggestion = signedIn && section === 'suggested_profiles';
        const item = (
          <ResultCard
            card={card}
            headingLevel={full ? 2 : 3}
            reason={sentence ? suggestionSentenceText(locale, sentence) : null}
            action={suggestion ? <SuggestedProfileActions candidate={card} /> : undefined}
          />
        );
        return suggestion ? (
          <DismissibleItem key={id}>{item}</DismissibleItem>
        ) : (
          <li key={id} className="grid">
            {item}
          </li>
        );
      })}
    </ResultGrid>
  );
}

/**
 * « Découvrir » (§10.6): the sections the api gives the reader, in its order (suggested profiles
 * for a member only), each with its grid and its full page. A visitor's view reveals each section
 * as it comes into view (D4, sober; at once with less motion).
 */
export async function DiscoverPage({
  sections,
  signedIn,
}: {
  sections: readonly DiscoverSectionPage[];
  signedIn: boolean;
}) {
  const t = await getTranslations('web.discover');
  return (
    <div className="grid gap-12">
      {sections.map((page) => {
        const section = page.section;
        const content = (
          <section aria-labelledby={`section-${section}`} className="grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="grid gap-1">
                <Heading level={2} size="section" id={`section-${section}`}>
                  {t(`sections.${section}.title`)}
                </Heading>
                <Text size="sm" tone="muted">
                  {t(`sections.${section}.description`)}
                </Text>
              </div>
              {page.items.length > 0 ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={routes.discoverSection(section)}>
                    {t('seeAll')}
                    <span className="sr-only">{t(`sections.${section}.title`)}</span>
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </div>
            <DiscoverSectionGrid page={page} signedIn={signedIn} />
          </section>
        );
        return signedIn ? (
          <div key={section}>{content}</div>
        ) : (
          <Reveal key={section}>{content}</Reveal>
        );
      })}
    </div>
  );
}

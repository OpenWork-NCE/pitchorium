import { discoveryControllerList, postsControllerRead } from '@pitchorium/api-client';
import type { FeedPage, Suggestion } from '@pitchorium/contracts';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ThreeColumnLayout } from '@/components/layout/page-layouts';
import { Heading } from '@/components/ui';
import { FeedComposer, FeedStream } from '@/features/content';
import { SuggestionsList } from '@/features/discovery';
import { ProfileCompletion } from '@/features/identity';
import { asLocale } from '@/i18n/routing';
import { configureServerApi } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('web.nav');
  return { title: t('home'), robots: { index: false, follow: false } };
}

/** Suggestions of the feed: a module every ten items on a narrow screen, the right column else. */
const SUGGESTIONS = 9;

/** The first page of the feed and the people suggested, read for the first render. */
async function firstRead(): Promise<[FeedPage | null, Suggestion[]]> {
  configureServerApi();
  const [feed, suggestions] = await Promise.allSettled([
    postsControllerRead({ limit: 20 }, { cache: 'no-store' }),
    discoveryControllerList({ list: 'people', limit: SUGGESTIONS }, { cache: 'no-store' }),
  ]);
  return [
    feed.status === 'fulfilled' ? feed.value : null,
    suggestions.status === 'fulfilled' ? suggestions.value.items : [],
  ];
}

/**
 * Home of the member space (§6.1, §10.3): no visible title above the feed (its name for screen
 * readers), the shell of the composer, then the feed. On a wide screen the completion of the
 * profile and the suggestions are side columns; on a narrow one, a module at the top of the feed
 * and modules among its items.
 */
export default async function Page({ params }: PageProps<'/[locale]/feed'>) {
  setRequestLocale(asLocale((await params).locale));
  const t = await getTranslations('web');
  const [feed, suggestions] = await firstRead();
  return (
    <ThreeColumnLayout
      leftLabel={t('feed.profileColumn')}
      rightLabel={t('feed.suggestions')}
      left={<ProfileCompletion variant="card" />}
      right={<SuggestionsList suggestions={suggestions.slice(0, 5)} />}
    >
      <div className="grid gap-4">
        <Heading level={1} size="page" className="sr-only">
          {t('nav.home')}
        </Heading>
        <FeedComposer />
        <div className="lg:hidden">
          <ProfileCompletion variant="module" />
        </div>
        <FeedStream initialPage={feed} suggestions={suggestions} />
      </div>
    </ThreeColumnLayout>
  );
}

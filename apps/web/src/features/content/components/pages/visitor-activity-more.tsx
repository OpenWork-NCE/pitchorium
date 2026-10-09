'use client';

import type { Post } from '@pitchorium/contracts';
import { useTranslations } from 'next-intl';
import { type ComponentType, useState } from 'react';
import { Button } from '@/components/ui';
import type { ActivityAuthor } from './visitor-activity-pages';

type PagesProps = { author: ActivityAuthor; posts: Post[]; cursor: string | null };

const loadPages = () => import('./visitor-activity-pages');

/**
 * « Afficher plus » under the activity a visitor reads: the code that reads and draws the next
 * publications loads at the first press (or when the pointer comes), never with the page.
 */
export function VisitorActivityMore({
  author,
  cursor,
}: {
  author: ActivityAuthor;
  cursor: string | null;
}) {
  const t = useTranslations('web.activity');
  const [loaded, setLoaded] = useState<{
    Pages: ComponentType<PagesProps>;
    props: PagesProps;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  if (loaded) return <loaded.Pages {...loaded.props} />;
  if (!cursor) return null;
  return (
    <Button
      variant="outline"
      className="justify-self-center"
      loading={loading}
      onPointerEnter={() => void loadPages()}
      onClick={() => {
        setLoading(true);
        void loadPages()
          .then(async (module) => {
            const page = await module.nextActivityPage(author, cursor);
            setLoaded({
              Pages: module.default,
              props: { author, posts: page.items, cursor: page.nextCursor },
            });
          })
          .catch(() => undefined)
          .finally(() => setLoading(false));
      }}
    >
      {t('more')}
    </Button>
  );
}

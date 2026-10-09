import type { ProjectUpdateFeedEntry } from '@pitchorium/contracts';
import { Megaphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, Card, RelativeTime, Truncate } from '@/components/ui';

/**
 * An update of a project the member follows (§11.3), as a simple card: the project, who wrote
 * it and when, its text. Not a link until the page of a project is delivered (PROMPT FRONT 5A).
 */
export function ProjectUpdateCard({ update }: { update: ProjectUpdateFeedEntry }) {
  const t = useTranslations('web.feed');
  return (
    <Card padding="none" className="grid gap-3 p-4 sm:p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <Megaphone aria-hidden className="size-4" />
        {t('projectUpdateLabel')}
      </p>
      <header className="flex items-start gap-3">
        <Avatar
          name={update.project.title}
          src={update.project.coverImageUrl}
          shape="square"
          decorative
        />
        <div className="grid min-w-0">
          <p className="truncate font-semibold">
            {t('projectUpdate', { project: update.project.title })}
          </p>
          <p className="text-xs text-muted">
            {update.author.displayName} · <RelativeTime date={update.publishedAt} />
          </p>
        </div>
      </header>
      <Truncate lines={6}>
        <p className="text-pretty break-words whitespace-pre-line">{update.text}</p>
      </Truncate>
    </Card>
  );
}

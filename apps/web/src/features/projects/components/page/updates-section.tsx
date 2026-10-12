import type { Project } from '@pitchorium/contracts';
import { getTranslations } from 'next-intl/server';
import { Avatar, Card, RelativeTime, Truncate } from '@/components/ui';
import { ImageGallery } from '@/features/content';
import { Translatable } from '@/features/localization';
import { ReportButton } from '@/features/trust';
import { SectionHeading } from './section-heading';

/**
 * « Actualités » of a project (§11.2, §11.3): the latest updates of its team, each with its
 * author, its date, its text and its images (their text alternatives, the viewer).
 */
export async function UpdatesSection({
  project,
  editorial,
  signedIn = false,
}: {
  project: Pick<Project, 'updates' | 'viewer'>;
  editorial: boolean;
  /** A member reads it: « Traduire » and, outside the team, « Signaler » on each update. */
  signedIn?: boolean;
}) {
  if (project.updates.length === 0) return null;
  const t = await getTranslations('web.projects.updates');
  return (
    <section aria-labelledby="updates-title" className="grid gap-4">
      <SectionHeading id="updates-title" editorial={editorial}>
        {t('title')}
      </SectionHeading>
      <ol className="grid gap-4">
        {project.updates.map((update) => (
          <li key={update.id}>
            <Card padding="none" className="grid gap-3 p-4 sm:p-5">
              <header className="flex items-center gap-3">
                <Avatar
                  name={update.author.displayName}
                  src={update.author.avatarUrl}
                  size="sm"
                  decorative
                />
                <p className="text-sm">
                  <span className="font-medium">{update.author.displayName}</span>
                  <span aria-hidden> · </span>
                  <span className="text-muted">
                    <RelativeTime date={update.publishedAt} />
                  </span>
                  {update.editedAt ? <span className="text-muted"> · {t('edited')}</span> : null}
                </p>
                {signedIn && !project.viewer?.teamRole ? (
                  <div className="ms-auto">
                    <ReportButton
                      variant="icon"
                      target={{ type: 'project_update', id: update.id }}
                      name={t('reportName', { name: update.author.displayName })}
                    />
                  </div>
                ) : null}
              </header>
              {signedIn ? (
                <Translatable
                  source={{ type: 'project_update', id: update.id }}
                  language={update.language}
                >
                  <Truncate lines={6}>
                    <p className="text-pretty break-words whitespace-pre-line">{update.text}</p>
                  </Truncate>
                </Translatable>
              ) : (
                <Truncate lines={6}>
                  <p className="text-pretty break-words whitespace-pre-line">{update.text}</p>
                </Truncate>
              )}
              {update.images.length > 0 ? (
                <ImageGallery images={update.images} postId={update.id} />
              ) : null}
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

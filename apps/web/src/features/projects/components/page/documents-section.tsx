import type { Project } from '@pitchorium/contracts';
import { getTranslations } from 'next-intl/server';
import { PostDocument } from '@/features/content';
import { SectionHeading } from './section-heading';

/**
 * « Documents » of a project (§11.2): private PDF files, listed by the api to signed-in members
 * only, opened or downloaded by an address it signs at the click (ADR 0026).
 */
export async function DocumentsSection({ project }: { project: Pick<Project, 'documents'> }) {
  if (project.documents.length === 0) return null;
  const t = await getTranslations('web.projects.documents');
  return (
    <section aria-labelledby="documents-title" className="grid gap-4">
      <SectionHeading id="documents-title" editorial={false}>
        {t('title')}
      </SectionHeading>
      <ul className="grid gap-3">
        {project.documents.map((document, index) => (
          <li key={document.mediaId}>
            <PostDocument
              signedIn
              document={{ ...document, title: t('document', { index: index + 1 }) }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

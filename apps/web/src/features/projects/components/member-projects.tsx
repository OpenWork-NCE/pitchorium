import {
  projectsControllerPublicShowcase,
  projectsControllerShowcase,
} from '@pitchorium/api-client';
import { getTranslations } from 'next-intl/server';
import { Heading } from '@/components/ui';
import { configureServerApi } from '@/lib/api/server';
import { ProjectCard } from './project-card';

/**
 * « Projets » of the page of a member (§10.1): the published projects whose public team counts
 * them (they consented to the public display, ADR 0040), as the api gives them to the reader.
 * Nothing when there is none.
 */
export async function MemberProjects({ handle, signedIn }: { handle: string; signedIn: boolean }) {
  configureServerApi();
  const query = { memberHandle: handle, limit: 6 };
  const options = { cache: 'no-store' } as const;
  const page = await (
    signedIn
      ? projectsControllerShowcase(query, options)
      : projectsControllerPublicShowcase(query, options)
  ).catch(() => null);
  if (!page || page.items.length === 0) return null;
  const t = await getTranslations('web.projects.member');
  return (
    <section aria-labelledby="member-projects-title" className="grid gap-4">
      <Heading level={2} size="section" id="member-projects-title">
        {t('title')}
      </Heading>
      <ul className="grid gap-4">
        {page.items.map((project) => (
          <li key={project.id} className="grid">
            <ProjectCard project={project} headingLevel={3} />
          </li>
        ))}
      </ul>
    </section>
  );
}

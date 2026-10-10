'use client';

import type { ProjectCard as ProjectCardData } from '@pitchorium/contracts';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Pagination } from '@/components/ui';
import { type ShowcaseFilters, showcaseQuery } from './showcase-query';

/* The cards of the next pages, loaded with them: the first page is rendered by the server. */
const ProjectCard = dynamic(() => import('../project-card').then((m) => m.ProjectCard));

/**
 * The next pages of the showcase, after the first one rendered by the server (cursor of the api):
 * plain requests, appended under it, the end announced.
 */
export function ShowcaseMore({
  filters,
  impactAvailable,
  cursor: first,
  signedIn,
  shown: initiallyShown,
}: {
  filters: ShowcaseFilters;
  impactAvailable: boolean;
  cursor: string | null;
  signedIn: boolean;
  shown: number;
}) {
  const t = useTranslations('web.projects.showcase');
  const [projects, setProjects] = useState<ProjectCardData[]>([]);
  const [cursor, setCursor] = useState(first);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function more() {
    if (!cursor) return;
    setLoading(true);
    setFailed(false);
    try {
      const query = showcaseQuery(filters, { impactAvailable, cursor });
      const { fetchShowcasePage } = await import('./showcase-fetch');
      const page = await fetchShowcasePage(query, signedIn);
      setProjects((current) => [...current, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {projects.length > 0 ? (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id} className="grid">
              <ProjectCard project={project} headingLevel={3} />
            </li>
          ))}
        </ul>
      ) : null}
      <Pagination
        hasMore={cursor !== null}
        loading={loading}
        onLoadMore={() => void more()}
        shown={initiallyShown + projects.length}
      />
      {failed ? (
        <p role="alert" className="text-center text-sm text-danger">
          {t('moreError')}
        </p>
      ) : null}
    </>
  );
}

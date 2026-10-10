import type { ProjectCard as ProjectCardData } from '@pitchorium/contracts';
import { FolderSearch } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { EmptyState, Heading } from '@/components/ui';
import { ProjectCard } from '../project-card';
import { ResetFilters, ShowcaseBrowser } from './showcase-browser';
import { ShowcaseMore } from './showcase-more';
import { isFiltered, type ShowcaseFilters } from './showcase-query';

interface Option {
  value: string;
  label: string;
}

/**
 * The showcase of the projects (§10.6): the editorial selection first when the api gives one and
 * no filter narrows the list, then a wide grid of cards, filtered by country, sector, status and
 * minimum impact, sorted by publication or by the nearest end, page after page. Too narrow
 * filters say so and offer to reset them.
 */
export async function ProjectShowcase({
  filters,
  featured,
  page,
  countries,
  sectors,
  impactAvailable,
  signedIn,
}: {
  filters: ShowcaseFilters;
  featured: readonly ProjectCardData[];
  page: { items: ProjectCardData[]; nextCursor: string | null } | null;
  countries: readonly Option[];
  sectors: readonly Option[];
  impactAvailable: boolean;
  signedIn: boolean;
}) {
  const t = await getTranslations('web.projects.showcase');
  const filtered = isFiltered(filters);
  const items = page?.items ?? [];
  return (
    <div className="grid gap-10">
      {featured.length > 0 && !filtered ? (
        <section aria-labelledby="featured-title" className="grid gap-4">
          <Heading level={2} size="section" id="featured-title">
            {t('featured')}
          </Heading>
          <ul className="grid gap-6 lg:grid-cols-2">
            {featured.map((project) => (
              <li key={project.id} className="grid">
                <ProjectCard project={project} headingLevel={3} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="all-title" className="grid gap-6">
        <Heading level={2} size="section" id="all-title">
          {t('all_projects')}
        </Heading>
        <ShowcaseBrowser countries={countries} sectors={sectors} impactAvailable={impactAvailable}>
          {page === null ? (
            <EmptyState size="page" title={t('error')} description={t('errorBody')} />
          ) : items.length === 0 ? (
            filtered ? (
              <EmptyState
                icon={<FolderSearch />}
                title={t('emptyFiltered')}
                description={t('emptyFilteredBody')}
                action={<ResetFilters />}
              />
            ) : (
              <EmptyState icon={<FolderSearch />} title={t('empty')} description={t('emptyBody')} />
            )
          ) : (
            <div className="grid gap-6">
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((project) => (
                  <li key={project.id} className="grid">
                    <ProjectCard project={project} headingLevel={3} />
                  </li>
                ))}
              </ul>
              <ShowcaseMore
                filters={filters}
                impactAvailable={impactAvailable}
                cursor={page.nextCursor}
                signedIn={signedIn}
                shown={items.length}
              />
            </div>
          )}
        </ShowcaseBrowser>
      </section>
    </div>
  );
}

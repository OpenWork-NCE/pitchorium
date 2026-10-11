import type { ProjectCard as ProjectCardData } from '@pitchorium/contracts';
import { cn } from '@/lib/cn';
import { gridLayout } from '../lib/grid-layout';
import { ProjectCard } from './project-card';

const LAYOUTS = {
  feature: 'grid',
  pair: 'grid gap-6 md:grid-cols-2',
  grid: 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3',
} as const;

/**
 * Cards of projects laid out from their count (ADR 0161, `gridLayout`): nothing for none, one
 * card featured across the width (its cover beside its text from `md`), two in two columns, a
 * grid from three. `itemClassName` for the motion of each card (`clip-reveal` on the home page).
 */
export function ProjectGrid({
  projects,
  headingLevel = 3,
  itemClassName,
  ...props
}: {
  projects: readonly ProjectCardData[];
  headingLevel?: 2 | 3;
  itemClassName?: string;
} & Omit<React.ComponentProps<'ul'>, 'children'>) {
  const layout = gridLayout(projects.length);
  if (layout === 'none') return null;
  return (
    <ul {...props} className={cn(LAYOUTS[layout], props.className)} data-layout={layout}>
      {projects.map((project) => (
        <li key={project.id} className={cn('grid', itemClassName)}>
          <ProjectCard
            project={project}
            headingLevel={headingLevel}
            variant={layout === 'feature' ? 'feature' : 'full'}
          />
        </li>
      ))}
    </ul>
  );
}

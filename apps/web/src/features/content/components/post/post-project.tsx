'use client';

import { useProjectsControllerGet } from '@pitchorium/api-client';
import { ProjectCard } from '@/features/projects';
import { Skeleton } from '@/components/ui';

/**
 * The project a publication is attached to (§10.3), as a compact card read for a member, linked
 * to the page of the project. Absent when the project is not visible to the reader.
 */
export function PostProject({ projectId }: { projectId: string }) {
  const project = useProjectsControllerGet(projectId, {
    query: { staleTime: 300_000, retry: false },
  });
  if (project.isPending) return <Skeleton className="h-28 w-full rounded-xl" />;
  if (!project.data) return null;
  return <ProjectCard project={project.data} variant="compact" headingLevel={3} />;
}

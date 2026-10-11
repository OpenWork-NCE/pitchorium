/**
 * The projects of the home page (ADR 0161): the editorial selection of the api first, completed
 * by the most recent projects in funding, up to `max`, each project once.
 */
export function homeProjects<T extends { id: string }>(
  featured: readonly T[],
  recent: readonly T[],
  max = 3,
): T[] {
  const seen = new Set<string>();
  const projects: T[] = [];
  for (const project of [...featured, ...recent]) {
    if (projects.length === max) break;
    if (seen.has(project.id)) continue;
    seen.add(project.id);
    projects.push(project);
  }
  return projects;
}

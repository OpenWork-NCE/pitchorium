import 'server-only';
import {
  contributionsControllerMine,
  organizationsControllerForMember,
  projectsControllerForMember,
} from '@pitchorium/api-client';
import type { ContributionStatus } from '@pitchorium/contracts';
import type { SupportedProject } from '@/features/engagement';
import { configureServerApi } from '@/lib/api/server';

/** Statuses of a contribution that supported a project (paid, even refunded in part). */
const PAID: readonly ContributionStatus[] = [
  'succeeded',
  'partially_refunded',
  'disputed',
  'dispute_won',
];

/** At most this many projects are listed, each read once for its status. */
const LIMIT = 24;

async function withStatus(projects: { id: string; slug: string; title: string }[]) {
  return Promise.all(
    projects.slice(0, LIMIT).map(async (project): Promise<SupportedProject> => {
      const read = await projectsControllerForMember(project.slug, { cache: 'no-store' }).catch(
        () => null,
      );
      return { ...project, status: read?.status ?? null };
    }),
  );
}

/** The projects the member supported by a paid contribution, newest first, with their status. */
export async function memberSupportedProjects(): Promise<SupportedProject[]> {
  configureServerApi();
  const page = await contributionsControllerMine({ limit: 100 }, { cache: 'no-store' }).catch(
    () => null,
  );
  const seen = new Map<string, { id: string; slug: string; title: string }>();
  for (const contribution of page?.items ?? []) {
    if (PAID.includes(contribution.status) && !seen.has(contribution.project.id)) {
      seen.set(contribution.project.id, contribution.project);
    }
  }
  return withStatus([...seen.values()]);
}

/** The projects an organisation supported, as its page lists them, with their status. */
export async function organizationSupportedProjects(slug: string): Promise<SupportedProject[]> {
  configureServerApi();
  const organization = await organizationsControllerForMember(slug, { cache: 'no-store' }).catch(
    () => null,
  );
  return withStatus(
    (organization?.projects.supported ?? []).map(({ projectId, slug: project, title }) => ({
      id: projectId,
      slug: project,
      title,
    })),
  );
}

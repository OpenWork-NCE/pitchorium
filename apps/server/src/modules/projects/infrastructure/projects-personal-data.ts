import { Injectable, type OnModuleInit } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, ne } from '@pitchorium/db/orm';
import {
  projectsInterests,
  projectsProjects,
  projectsTeamMembers,
  projectsUpdates,
} from '@pitchorium/db/schemas/projects';
import { replaceIdentifier } from '../../../platform/compliance';
import { TransactionManager } from '../../../platform/database';
import { Clock } from '../../../platform/kernel';
import { MediaFacade } from '../../media';
import { type ErasureBlocker, ERASURE_ORDER, PrivacyFacade } from '../../privacy';
import { ProjectEventsRecorder } from '../application/project-events.recorder';
import { ProjectDeleted, ProjectUpdated } from '../domain/project-events';

/** A campaign that still collects contributions: the erasure of its holder waits for its end. */
const OPEN_STATUSES = ['funding', 'funded'];

/**
 * Personal data of projects: projects held, team memberships, updates written, expressions of
 * interest. Erasure rules: blocked while a campaign of the holder collects contributions
 * (PRIVACY_CAMPAIGN_IN_PROGRESS); the holding passes to another active owner of the team when
 * there is one; a project with contributions is kept under the pseudonym (shown as « Membre
 * supprimé »); any other project is deleted.
 */
@Injectable()
export class ProjectsPersonalData implements OnModuleInit {
  constructor(
    private readonly privacy: PrivacyFacade,
    private readonly events: ProjectEventsRecorder,
    private readonly media: MediaFacade,
    private readonly transactions: TransactionManager,
    private readonly clock: Clock,
  ) {}

  private get db() {
    return this.transactions.executor;
  }

  onModuleInit(): void {
    this.privacy.registerPersonalData({
      module: 'projects',
      description:
        'The projects you hold, your roles in project teams, the updates you wrote and your expressions of interest.',
      order: ERASURE_ORDER.ownership,
      exporter: {
        export: async (userId) => ({
          data: {
            projects: await this.db
              .select()
              .from(projectsProjects)
              .where(and(eq(projectsProjects.ownerId, userId), isNull(projectsProjects.deletedAt))),
            teams: await this.db
              .select()
              .from(projectsTeamMembers)
              .where(eq(projectsTeamMembers.userId, userId)),
            updates: await this.db
              .select()
              .from(projectsUpdates)
              .where(eq(projectsUpdates.authorId, userId)),
            interests: await this.db
              .select()
              .from(projectsInterests)
              .where(eq(projectsInterests.userId, userId)),
          },
        }),
      },
      eraser: {
        blockers: (userId) => this.blockers(userId),
        erase: ({ userId, pseudonym }) => this.erase(userId, pseudonym),
      },
    });
  }

  private async blockers(userId: string): Promise<ErasureBlocker[]> {
    const open = await this.db
      .select({ id: projectsProjects.id })
      .from(projectsProjects)
      .where(
        and(
          eq(projectsProjects.ownerId, userId),
          inArray(projectsProjects.status, OPEN_STATUSES),
          isNull(projectsProjects.deletedAt),
        ),
      );
    return open.map((project) => ({
      code: 'PRIVACY_CAMPAIGN_IN_PROGRESS',
      resourceId: project.id,
    }));
  }

  private async erase(userId: string, pseudonym: string): Promise<void> {
    const db = this.db;
    const now = this.clock.now();
    const held = await db
      .select()
      .from(projectsProjects)
      .where(eq(projectsProjects.ownerId, userId));
    for (const project of held) {
      const [nextOwner] = await db
        .select({ userId: projectsTeamMembers.userId })
        .from(projectsTeamMembers)
        .where(
          and(
            eq(projectsTeamMembers.projectId, project.id),
            eq(projectsTeamMembers.role, 'owner'),
            eq(projectsTeamMembers.status, 'active'),
            ne(projectsTeamMembers.userId, userId),
          ),
        )
        .orderBy(asc(projectsTeamMembers.joinedAt));
      if (nextOwner && !project.deletedAt) {
        await db
          .update(projectsProjects)
          .set({ ownerId: nextOwner.userId, updatedAt: now })
          .where(eq(projectsProjects.id, project.id));
        await this.events.record(ProjectUpdated, project.id, { fields: ['owner'] });
      } else if (
        project.contributionCount > 0 ||
        project.firstContributionAt ||
        project.deletedAt
      ) {
        await db
          .update(projectsProjects)
          .set({ ownerId: pseudonym, updatedAt: now })
          .where(eq(projectsProjects.id, project.id));
        if (!project.deletedAt)
          await this.events.record(ProjectUpdated, project.id, { fields: ['owner'] });
      } else {
        await db
          .update(projectsProjects)
          .set({ ownerId: pseudonym, deletedAt: now, updatedAt: now })
          .where(eq(projectsProjects.id, project.id));
        for (const mediaId of [...project.galleryMediaIds, ...project.documentMediaIds]) {
          await this.media.detach(mediaId);
        }
        await this.events.record(ProjectDeleted, project.id, { deletedBy: pseudonym });
      }
    }
    await db.delete(projectsTeamMembers).where(eq(projectsTeamMembers.userId, userId));
    await db.delete(projectsInterests).where(eq(projectsInterests.userId, userId));
    await replaceIdentifier(
      db,
      [
        { table: 'projects.updates', column: 'author_id' },
        { table: 'projects.projects', column: 'public_display_consent_by' },
        { table: 'projects.projects', column: 'featured_by' },
        { table: 'projects.team_members', column: 'invited_by' },
      ],
      userId,
      pseudonym,
    );
  }
}

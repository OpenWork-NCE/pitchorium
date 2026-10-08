import { Injectable, type OnModuleInit } from '@nestjs/common';
import { LocalizationFacade } from '../../localization';
import { ProjectReadsService } from '../application/project-reads.service';
import { ProjectRepository } from '../application/ports';

const filled = (fields: Record<string, string | null>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(fields).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim())),
  );

/**
 * Projects (title, summary, description) and their updates offered to the translation on
 * demand (§8.3), when the reader may read the project.
 */
@Injectable()
export class ProjectsTranslatable implements OnModuleInit {
  constructor(
    private readonly localization: LocalizationFacade,
    private readonly projects: ProjectRepository,
    private readonly reads: ProjectReadsService,
  ) {}

  onModuleInit(): void {
    this.localization.registerTranslatableSource({
      type: 'project',
      read: async (id, readerId) => {
        const project = await this.projects.findProject(id);
        if (
          !project ||
          !(await this.reads.readable(project, { kind: 'member', viewerId: readerId }))
        ) {
          return null;
        }
        return {
          key: project.id,
          fields: filled({
            title: project.title,
            summary: project.summary,
            description: project.description,
          }),
          language: null,
        };
      },
    });
    this.localization.registerTranslatableSource({
      type: 'project_update',
      read: async (id, readerId) => {
        const update = await this.projects.findUpdate(id);
        if (!update || update.deletedAt || update.moderationStatus !== 'visible') return null;
        const project = await this.projects.findProject(update.projectId);
        if (
          !project ||
          !(await this.reads.readable(project, { kind: 'member', viewerId: readerId }))
        ) {
          return null;
        }
        return { key: update.id, fields: filled({ text: update.text }), language: null };
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import type { CreateProjectUpdateRequest, EditProjectUpdateRequest } from '@pitchorium/contracts';
import { TransactionManager } from '../../../platform/database';
import { Clock, DomainError, IdGenerator } from '../../../platform/kernel';
import { MediaFacade } from '../../media';
import type { UpdateRecord } from '../domain/activity';
import { imageAlts, isPublished, type ProjectRecord } from '../domain/project';
import { UpdatePublished } from '../domain/project-events';
import { ProjectEventsRecorder } from './project-events.recorder';
import { ProjectRepository } from './ports';

/** Resource of the images of an update in the media module. */
export const PROJECT_UPDATE_RESOURCE = 'project_update';

const updateNotFound = () =>
  new DomainError('PROJECTS_UPDATE_NOT_FOUND', 'Project update not found');

/**
 * Campaign updates (section 11.3), written by the team of a published project. Their
 * visibility follows the project's: public with it, images included; the followers of the
 * project read them in their feed.
 */
@Injectable()
export class UpdatesService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly media: MediaFacade,
    private readonly events: ProjectEventsRecorder,
    private readonly transactions: TransactionManager,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async publish(
    projectId: string,
    authorId: string,
    request: CreateProjectUpdateRequest,
  ): Promise<UpdateRecord> {
    const project = await this.projects.findProject(projectId);
    if (!project || project.deletedAt) {
      throw new DomainError('PROJECTS_NOT_FOUND', 'Project not found');
    }
    if (!isPublished(project)) {
      throw new DomainError('PROJECTS_NOT_OPEN', 'Updates are published on a published project');
    }
    const update: UpdateRecord = {
      id: this.ids.next(),
      projectId,
      authorId,
      text: request.text,
      imageMediaIds: request.imageMediaIds ?? [],
      imageAlts: imageAlts(request.imageMediaIds ?? [], request.imageAlts ?? {}),
      moderationStatus: 'visible',
      publishedAt: this.clock.now(),
      editedAt: null,
      deletedAt: null,
    };
    await this.transactions.run(async () => {
      await this.projects.insertUpdate(update);
      for (const mediaId of update.imageMediaIds) {
        await this.media.attach({
          mediaId,
          ownerId: authorId,
          usage: 'project_update_image',
          resource: { type: PROJECT_UPDATE_RESOURCE, id: update.id },
          resourceVisibility: visibilityOf(project),
        });
      }
      await this.events.record(UpdatePublished, projectId, { updateId: update.id, authorId });
    });
    return update;
  }

  async edit(
    projectId: string,
    updateId: string,
    request: EditProjectUpdateRequest,
  ): Promise<UpdateRecord> {
    const update = await this.require(projectId, updateId);
    const patch = {
      text: request.text,
      editedAt: this.clock.now(),
      imageAlts: request.imageAlts
        ? imageAlts(update.imageMediaIds, request.imageAlts)
        : update.imageAlts,
    };
    await this.projects.updateUpdate(updateId, patch);
    return { ...update, ...patch };
  }

  /** Logical deletion; the images are detached, then removed by the orphan cleanup. */
  async delete(projectId: string, updateId: string): Promise<void> {
    const update = await this.require(projectId, updateId);
    await this.transactions.run(async () => {
      await this.projects.updateUpdate(updateId, { deletedAt: this.clock.now() });
      for (const mediaId of update.imageMediaIds) await this.media.detach(mediaId);
    });
  }

  private async require(projectId: string, updateId: string): Promise<UpdateRecord> {
    const update = await this.projects.findUpdate(updateId);
    if (!update || update.projectId !== projectId || update.deletedAt) throw updateNotFound();
    return update;
  }
}

/** Images of an update are public while the project is published and visible. */
export function visibilityOf(project: ProjectRecord): 'public' | 'private' {
  return isPublished(project) && project.moderationStatus === 'visible' ? 'public' : 'private';
}

import { Injectable } from '@nestjs/common';
import type { ProjectUpdateFeedEntry } from '@pitchorium/contracts';
import { DomainError } from '../../../platform/kernel';
import type { KeysetPosition } from '../../../platform/kernel';
import type { FeedEntry, ProjectLinkValidator, ProjectUpdatesFeedSource } from './ports';

/**
 * Extension points filled by the projects module: the validator of the project a publication
 * is attached to (until then every project is refused), and the updates of the followed
 * projects for the feed (until then none).
 */
@Injectable()
export class ProjectLinkRegistry {
  private validator: ProjectLinkValidator | undefined;
  private updates: ProjectUpdatesFeedSource | undefined;

  register(validator: ProjectLinkValidator): void {
    if (this.validator) throw new Error('A project link validator is already registered');
    this.validator = validator;
  }

  async assertAttachable(projectId: string, authorId: string): Promise<void> {
    if (!(await this.validator?.canAttach(projectId, authorId))) {
      throw new DomainError('CONTENT_PROJECT_NOT_FOUND', 'Project not found');
    }
  }

  registerUpdatesSource(source: ProjectUpdatesFeedSource): void {
    if (this.updates) throw new Error('A project updates feed source is already registered');
    this.updates = source;
  }

  async updateEntries(
    viewerId: string,
    after: KeysetPosition | null,
    limit: number,
  ): Promise<FeedEntry[]> {
    return this.updates ? this.updates.entries(viewerId, after, limit) : [];
  }

  async presentUpdates(
    viewerId: string,
    ids: readonly string[],
  ): Promise<Map<string, ProjectUpdateFeedEntry>> {
    return this.updates && ids.length > 0 ? this.updates.present(viewerId, ids) : new Map();
  }
}

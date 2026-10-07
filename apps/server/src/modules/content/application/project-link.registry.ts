import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../platform/kernel';
import type { ProjectLinkValidator } from './ports';

/**
 * Validator of the project a publication is attached to, registered by the projects module.
 * Until then every project is refused (no project exists).
 */
@Injectable()
export class ProjectLinkRegistry {
  private validator: ProjectLinkValidator | undefined;

  register(validator: ProjectLinkValidator): void {
    if (this.validator) throw new Error('A project link validator is already registered');
    this.validator = validator;
  }

  async assertAttachable(projectId: string, authorId: string): Promise<void> {
    if (!(await this.validator?.canAttach(projectId, authorId))) {
      throw new DomainError('CONTENT_PROJECT_NOT_FOUND', 'Project not found');
    }
  }
}

import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../platform/kernel';
import type { OrganizationDirectory, OrganizationSummary } from './ports';

/** Holds the directory registered by the organizations module; fails closed without it. */
@Injectable()
export class OrganizationDirectoryRegistry {
  private directory: OrganizationDirectory | undefined;

  register(directory: OrganizationDirectory): void {
    if (this.directory) throw new Error('An organization directory is already registered');
    this.directory = directory;
  }

  /** A contributor may only link an organization they are a member of. */
  async assertLinkable(organizationId: string, userId: string): Promise<void> {
    if (!(await this.directory?.isMember(organizationId, userId))) {
      throw new DomainError(
        'PROFILES_ORGANIZATION_NOT_ALLOWED',
        'The member does not belong to this organization',
      );
    }
  }

  async summaries(ids: readonly string[]): Promise<Map<string, OrganizationSummary>> {
    if (!this.directory || ids.length === 0) return new Map();
    return this.directory.summaries(ids);
  }
}

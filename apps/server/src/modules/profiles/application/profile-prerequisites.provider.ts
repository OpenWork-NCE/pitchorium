import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { PrerequisiteElement } from '@pitchorium/contracts';
import { AccessFacade, type PrerequisiteProvider } from '../../access';
import { ProfileRepository } from './ports';

/** Tells the access module which profile elements a member still has to complete. */
@Injectable()
export class ProfilePrerequisitesProvider implements PrerequisiteProvider, OnModuleInit {
  readonly elements: readonly PrerequisiteElement[] = [
    'profile.entrepreneur_facet',
    'profile.contributor_facet',
  ];

  constructor(
    private readonly profiles: ProfileRepository,
    private readonly access: AccessFacade,
  ) {}

  onModuleInit(): void {
    this.access.registerPrerequisiteProvider(this);
  }

  async missing(
    userId: string,
    elements: readonly PrerequisiteElement[],
  ): Promise<PrerequisiteElement[]> {
    const profile = await this.profiles.findByUserId(userId);
    return elements.filter((element) =>
      element === 'profile.entrepreneur_facet'
        ? !profile?.entrepreneur
        : element === 'profile.contributor_facet'
          ? !profile?.contributor
          : true,
    );
  }
}

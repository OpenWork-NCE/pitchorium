import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { PrerequisiteElement } from '@pitchorium/contracts';
import { AccessFacade, type PrerequisiteProvider } from '../../access';
import { hasMinimumProfile } from '../domain/profile';
import { ProfileRepository } from './ports';

/** Tells the access module which profile elements a member still has to complete. */
@Injectable()
export class ProfilePrerequisitesProvider implements PrerequisiteProvider, OnModuleInit {
  readonly elements: readonly PrerequisiteElement[] = [
    'profile.minimum',
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
    const missing: Partial<Record<PrerequisiteElement, boolean>> = {
      'profile.minimum': !profile || !hasMinimumProfile(profile.base),
      'profile.entrepreneur_facet': !profile?.entrepreneur,
      'profile.contributor_facet': !profile?.contributor,
    };
    return elements.filter((element) => missing[element] ?? true);
  }
}

import { Injectable, type OnModuleInit } from '@nestjs/common';
import { LocalizationFacade } from '../../localization';
import { MissionReadsService } from '../application/mission-reads.service';
import { MissionsRepository } from '../application/ports';

/** Title and description of a mission the reader sees, for the translation on demand (§8.3). */
@Injectable()
export class MissionsTranslatable implements OnModuleInit {
  constructor(
    private readonly localization: LocalizationFacade,
    private readonly missions: MissionsRepository,
    private readonly reads: MissionReadsService,
  ) {}

  onModuleInit(): void {
    this.localization.registerTranslatableSource({
      type: 'mission',
      read: async (id, readerId) => {
        const mission = await this.missions.findMission(id);
        if (
          !mission ||
          !(await this.reads.canSee(mission, { kind: 'member', viewerId: readerId }))
        ) {
          return null;
        }
        return {
          key: mission.id,
          fields: { title: mission.title, description: mission.description },
          language: null,
        };
      },
    });
  }
}

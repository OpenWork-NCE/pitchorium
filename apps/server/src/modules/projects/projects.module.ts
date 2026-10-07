import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { FundingService } from './application/funding.service';
import { InterestsService } from './application/interests.service';
import { ProjectEventsRecorder } from './application/project-events.recorder';
import { ProjectImpactService } from './application/project-impact.service';
import { ProjectMaintenanceService } from './application/project-maintenance.service';
import { ProjectReadsService } from './application/project-reads.service';
import { ProjectsFacade } from './application/projects.facade';
import { ProjectsService } from './application/projects.service';
import { ProjectRepository } from './application/ports';
import { RewardsService } from './application/rewards.service';
import { TeamService } from './application/team.service';
import { UpdatesService } from './application/updates.service';
import { DrizzleProjectsRepository } from './infrastructure/drizzle-projects.repository';
import { InterestsController } from './interface/interests.controller';
import { ProjectImpactController } from './interface/project-impact.controller';
import { ProjectResolver } from './interface/project.resolver';
import { ProjectsController } from './interface/projects.controller';
import { ProjectsJobsProcessor } from './interface/projects-jobs.processor';
import { PROJECTS_QUEUE } from './interface/projects-queue';
import { RewardsController } from './interface/rewards.controller';
import { TeamController } from './interface/team.controller';
import { UpdatesController } from './interface/updates.controller';

const SHARED_PROVIDERS: Provider[] = [
  { provide: ProjectRepository, useClass: DrizzleProjectsRepository },
  ProjectEventsRecorder,
  ProjectReadsService,
  ProjectsService,
  FundingService,
  RewardsService,
  ProjectsFacade,
];

/**
 * Projects and campaigns (section 11). Global so that the payments and trust modules can
 * inject ProjectsFacade; imports go through index.ts.
 */
@Module({})
export class ProjectsModule {
  static forApi(): DynamicModule {
    return {
      module: ProjectsModule,
      global: true,
      controllers: [
        ProjectsController,
        TeamController,
        RewardsController,
        UpdatesController,
        InterestsController,
        ProjectImpactController,
      ],
      providers: [
        ...SHARED_PROVIDERS,
        TeamService,
        UpdatesService,
        InterestsService,
        ProjectImpactService,
        ProjectResolver,
      ],
      exports: [ProjectsFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: ProjectsModule,
      global: true,
      imports: [BullModule.registerQueue({ name: PROJECTS_QUEUE })],
      providers: [...SHARED_PROVIDERS, ProjectMaintenanceService, ProjectsJobsProcessor],
      exports: [ProjectsFacade],
    };
  }
}

import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { AssessmentsService } from './application/assessments.service';
import { ImpactEventsRecorder } from './application/impact-events.recorder';
import { ImpactFacade } from './application/impact.facade';
import { MethodologiesService } from './application/methodologies.service';
import { ImpactRepository } from './application/ports';
import { DrizzleImpactRepository } from './infrastructure/drizzle-impact.repository';
import { MethodologiesController } from './interface/methodologies.controller';
import { MyAssessmentsController } from './interface/my-assessments.controller';

const PROVIDERS: Provider[] = [
  { provide: ImpactRepository, useClass: DrizzleImpactRepository },
  ImpactEventsRecorder,
  AssessmentsService,
  MethodologiesService,
  ImpactFacade,
];

/**
 * Versioned self-declared impact methodology and assessments (section 12). Global so that the
 * projects module can inject ImpactFacade; imports go through index.ts. The worker has no
 * impact task: it only loads the facade.
 */
@Module({})
export class ImpactModule {
  static forApi(): DynamicModule {
    return {
      module: ImpactModule,
      global: true,
      controllers: [MethodologiesController, MyAssessmentsController],
      providers: PROVIDERS,
      exports: [ImpactFacade],
    };
  }

  static forWorker(): DynamicModule {
    return { module: ImpactModule, global: true, providers: PROVIDERS, exports: [ImpactFacade] };
  }
}

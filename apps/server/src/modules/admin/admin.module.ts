import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { FailedJobsService } from '../../platform/queue';
import { BackOfficeService } from './application/back-office.service';
import { AdminRepository } from './application/ports';
import { AdminPersonalData } from './infrastructure/admin-personal-data';
import { DrizzleAdminRepository } from './infrastructure/drizzle-admin.repository';
import { AdminController } from './interface/admin.controller';

const SHARED_PROVIDERS: Provider[] = [
  { provide: AdminRepository, useClass: DrizzleAdminRepository },
  AdminPersonalData,
];

/**
 * Back office of the api (§13, §14, ADR 0078): no other module depends on it; it reads and
 * acts through their facades. The worker only registers its personal data.
 */
@Module({})
export class AdminModule {
  static forApi(): DynamicModule {
    return {
      module: AdminModule,
      controllers: [AdminController],
      providers: [...SHARED_PROVIDERS, FailedJobsService, BackOfficeService],
    };
  }

  static forWorker(): DynamicModule {
    return { module: AdminModule, providers: SHARED_PROVIDERS };
  }
}

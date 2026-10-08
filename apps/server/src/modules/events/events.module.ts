import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { CalendarService } from './application/calendar.service';
import { EventEventsRecorder } from './application/event-events.recorder';
import { EventReadsService } from './application/event-reads.service';
import { EventsFacade } from './application/events.facade';
import { EventsMaintenanceService } from './application/events-maintenance.service';
import { EventsService } from './application/events.service';
import { EventsRepository } from './application/ports';
import { RegistrationsService } from './application/registrations.service';
import { DrizzleEventsRepository } from './infrastructure/drizzle-events.repository';
import { EventResolver } from './interface/event.resolver';
import { EventsController } from './interface/events.controller';
import { EventsJobsProcessor } from './interface/events-jobs.processor';
import { EVENTS_QUEUE } from './interface/events-queue';

import { EventsPersonalData } from './infrastructure/events-personal-data';

const SHARED_PROVIDERS: Provider[] = [
  { provide: EventsRepository, useClass: DrizzleEventsRepository },
  EventEventsRecorder,
  EventReadsService,
  EventsService,
  RegistrationsService,
  EventsFacade,
  EventsPersonalData,
];

/**
 * Events (§14, scope to validate, ADR 0069 and 0070). Global so that the discovery and
 * notifications modules can inject EventsFacade; imports go through index.ts.
 */
@Module({})
export class EventsModule {
  static forApi(): DynamicModule {
    return {
      module: EventsModule,
      global: true,
      controllers: [EventsController],
      providers: [...SHARED_PROVIDERS, CalendarService, EventResolver],
      exports: [EventsFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: EventsModule,
      global: true,
      imports: [BullModule.registerQueue({ name: EVENTS_QUEUE })],
      providers: [...SHARED_PROVIDERS, EventsMaintenanceService, EventsJobsProcessor],
      exports: [EventsFacade],
    };
  }
}

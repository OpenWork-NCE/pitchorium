import { Module } from '@nestjs/common';
import { FailedJobsService, QueueModule } from '../queue';
import { MaintenanceProcessor } from './maintenance.processor';
import { QueueMetricsService } from './queue-metrics.service';

@Module({
  imports: [QueueModule],
  providers: [MaintenanceProcessor, FailedJobsService, QueueMetricsService],
})
export class MaintenanceModule {}

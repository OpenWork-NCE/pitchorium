import { Module } from '@nestjs/common';
import { QueueModule } from '../queue';
import { MaintenanceProcessor } from './maintenance.processor';

@Module({ imports: [QueueModule], providers: [MaintenanceProcessor] })
export class MaintenanceModule {}

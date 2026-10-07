import { Module } from '@nestjs/common';
import { API_BUSINESS_MODULES } from './business-modules';
import { PlatformModule } from './platform/platform.module';

/** Root module of the api process (HTTP and Socket.IO). */
@Module({ imports: [PlatformModule.forApi(), ...API_BUSINESS_MODULES] })
export class AppModule {}

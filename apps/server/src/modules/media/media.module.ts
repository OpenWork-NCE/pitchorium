import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { MediaCdnPurgeService } from './application/media-cdn-purge.service';
import { MediaEventsRecorder } from './application/media-events.recorder';
import { MediaFacade } from './application/media.facade';
import { MediaMaintenanceService } from './application/media-maintenance.service';
import { MediaProcessingService } from './application/media-processing.service';
import { MediaReadRegistry } from './application/media-read.registry';
import { MediaUploadsService } from './application/media-uploads.service';
import { MediaVisibilityService } from './application/media-visibility.service';
import {
  ContentTypeDetector,
  ImageProcessor,
  MalwareScanner,
  MediaRepository,
  PdfInspector,
  RemoteImageFetcher,
  UploadRateLimiter,
} from './application/ports';
import { AllowlistedImageFetcher } from './infrastructure/allowlisted-image.fetcher';
import { ClamAvMalwareScanner } from './infrastructure/clamav.malware-scanner';
import { DrizzleMediaRepository } from './infrastructure/drizzle-media.repository';
import { FileTypeDetector } from './infrastructure/file-type.detector';
import { PdfJsInspector } from './infrastructure/pdfjs.pdf-inspector';
import { RedisUploadRateLimiter } from './infrastructure/redis-upload-rate.limiter';
import { SharpImageProcessor } from './infrastructure/sharp.image-processor';
import { MediaController } from './interface/media.controller';
import { MediaJobsProcessor } from './interface/media-jobs.processor';
import { MediaProcessingHandler } from './interface/media-processing.handler';
import { MEDIA_QUEUE } from './interface/media-queue';

const SHARED_PROVIDERS: Provider[] = [
  { provide: MediaRepository, useClass: DrizzleMediaRepository },
  MediaReadRegistry,
  MediaEventsRecorder,
  MediaFacade,
];

/**
 * Files and their metadata (ADR 0022). Global so that other modules can inject MediaFacade;
 * imports still go through index.ts.
 */
@Module({})
export class MediaModule {
  static forApi(): DynamicModule {
    return {
      module: MediaModule,
      global: true,
      controllers: [MediaController],
      providers: [
        ...SHARED_PROVIDERS,
        MediaUploadsService,
        { provide: UploadRateLimiter, useClass: RedisUploadRateLimiter },
      ],
      exports: [MediaFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: MediaModule,
      global: true,
      imports: [BullModule.registerQueue({ name: MEDIA_QUEUE })],
      providers: [
        ...SHARED_PROVIDERS,
        MediaProcessingService,
        MediaMaintenanceService,
        MediaVisibilityService,
        MediaCdnPurgeService,
        { provide: ContentTypeDetector, useClass: FileTypeDetector },
        { provide: MalwareScanner, useClass: ClamAvMalwareScanner },
        { provide: ImageProcessor, useClass: SharpImageProcessor },
        { provide: PdfInspector, useClass: PdfJsInspector },
        { provide: RemoteImageFetcher, useClass: AllowlistedImageFetcher },
        MediaJobsProcessor,
        MediaProcessingHandler,
      ],
      exports: [MediaFacade],
    };
  }
}

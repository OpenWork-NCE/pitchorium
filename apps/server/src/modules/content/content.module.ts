import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Module, type Provider } from '@nestjs/common';
import { CommentsService } from './application/comments.service';
import { ContentEventsRecorder } from './application/content-events.recorder';
import { ContentFacade } from './application/content.facade';
import { ContentMaintenanceService } from './application/content-maintenance.service';
import { FeedService } from './application/feed.service';
import {
  ContentRepository,
  LanguageDetector,
  LinkPageFetcher,
  PostViewCounter,
} from './application/ports';
import { PostPresenter } from './application/post-presenter';
import { PostsService } from './application/posts.service';
import { FeedSourcesRegistry } from './application/feed-sources.registry';
import { ProjectLinkRegistry } from './application/project-link.registry';
import { LinkPreviewsService } from './application/link-previews.service';
import { ReactionsService } from './application/reactions.service';
import { DrizzleContentRepository } from './infrastructure/drizzle-content.repository';
import { FrancLanguageDetector } from './infrastructure/franc.language-detector';
import { RedisPostViewCounter } from './infrastructure/redis-post-view.counter';
import { SafeLinkPageFetcher } from './infrastructure/safe-link-page.fetcher';
import { CommentsController } from './interface/comments.controller';
import {
  LinkPreviewDraftHandler,
  LinkPreviewHandler,
  LinkPreviewImageHandler,
  PublicPageHandler,
} from './interface/content-events.handlers';
import { ContentJobsProcessor } from './interface/content-jobs.processor';
import { CONTENT_QUEUE } from './interface/content-queue';
import { CommentResolver, PostResolver } from './interface/content.resolvers';
import { LinkPreviewsController } from './interface/link-previews.controller';
import { PostsController } from './interface/posts.controller';

import { ContentPersonalData } from './infrastructure/content-personal-data';

import { ContentTranslatable } from './infrastructure/content-translatable';

import { PostHighlightsService } from './application/post-highlights.service';

const SHARED_PROVIDERS: Provider[] = [
  ContentTranslatable,
  ContentPersonalData,
  { provide: ContentRepository, useClass: DrizzleContentRepository },
  { provide: PostViewCounter, useClass: RedisPostViewCounter },
  ContentEventsRecorder,
  ProjectLinkRegistry,
  FeedSourcesRegistry,
  PostPresenter,
  PostHighlightsService,
  ContentFacade,
];

/**
 * Publications, reposts, comments, reactions and the feed (§10.3). Global so that trust and
 * projects can inject ContentFacade; imports go through index.ts.
 */
@Module({})
export class ContentModule {
  static forApi(): DynamicModule {
    return {
      module: ContentModule,
      global: true,
      controllers: [PostsController, CommentsController, LinkPreviewsController],
      providers: [
        ...SHARED_PROVIDERS,
        { provide: LanguageDetector, useClass: FrancLanguageDetector },
        PostsService,
        FeedService,
        CommentsService,
        ReactionsService,
        LinkPreviewsService,
        PostResolver,
        CommentResolver,
      ],
      exports: [ContentFacade],
    };
  }

  static forWorker(): DynamicModule {
    return {
      module: ContentModule,
      global: true,
      imports: [BullModule.registerQueue({ name: CONTENT_QUEUE })],
      providers: [
        ...SHARED_PROVIDERS,
        { provide: LinkPageFetcher, useClass: SafeLinkPageFetcher },
        ContentMaintenanceService,
        ContentJobsProcessor,
        LinkPreviewHandler,
        LinkPreviewDraftHandler,
        LinkPreviewImageHandler,
        PublicPageHandler,
      ],
      exports: [ContentFacade],
    };
  }
}

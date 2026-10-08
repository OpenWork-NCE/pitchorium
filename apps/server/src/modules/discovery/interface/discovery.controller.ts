import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  autocompleteQuerySchema,
  autocompleteResultSchema,
  type AutocompleteItem,
  type CursorPage,
  cursorPageQuerySchema,
  discoverPageQuerySchema,
  discoverPageSchema,
  type DiscoverPage,
  discoverSectionPageSchema,
  type DiscoverSectionPage,
  discoverSectionParamsSchema,
  type DiscoveryCard,
  dismissalParamsSchema,
  dismissSuggestionRequestSchema,
  projectIdForSuggestionsParamsSchema,
  searchQuerySchema,
  searchResultPageSchema,
  type Suggestion,
  suggestionPageSchema,
  suggestionsQuerySchema,
} from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { DiscoverService } from '../application/discover.service';
import { SearchService } from '../application/search.service';
import { SuggestionsService } from '../application/suggestions.service';
import { ProjectTeamResolver } from './project-team.resolver';

class SearchQueryDto extends createZodDto(searchQuerySchema) {}
class SearchResultPageDto extends createZodDto(searchResultPageSchema) {}
class AutocompleteQueryDto extends createZodDto(autocompleteQuerySchema) {}
class AutocompleteResultDto extends createZodDto(autocompleteResultSchema) {}
class SuggestionsQueryDto extends createZodDto(suggestionsQuerySchema) {}
class SuggestionPageDto extends createZodDto(suggestionPageSchema) {}
class DismissDto extends createZodDto(dismissSuggestionRequestSchema) {}
class DismissalParamsDto extends createZodDto(dismissalParamsSchema) {}
class DiscoverPageQueryDto extends createZodDto(discoverPageQuerySchema) {}
class DiscoverPageDto extends createZodDto(discoverPageSchema) {}
class DiscoverSectionPageDto extends createZodDto(discoverSectionPageSchema) {}
class DiscoverSectionParamsDto extends createZodDto(discoverSectionParamsSchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}
class ProjectIdParamsDto extends createZodDto(projectIdForSuggestionsParamsSchema) {}

/** Short shared cache for the public reads. */
const PUBLIC_CACHE = 'public, max-age=60';

/**
 * Search, autocompletion, explained suggestions and Discover page (§10.2, §10.6, §11.4). A
 * visitor searches what is public; a member what their privacy settings and blocks allow.
 */
@ApiTags('discovery')
@Controller()
export class DiscoveryController {
  constructor(
    private readonly search: SearchService,
    private readonly suggestions: SuggestionsService,
    private readonly discover: DiscoverService,
  ) {}

  @Get('discovery/search')
  @RequireAction('discovery.search')
  @ZodSerializerDto(SearchResultPageDto)
  @ApiOkResponse({ type: SearchResultPageDto.Output })
  searchAsMember(
    @CurrentPrincipal() principal: Principal,
    @Query() query: SearchQueryDto,
  ): Promise<CursorPage<DiscoveryCard>> {
    return this.search.search(query, { kind: 'member', viewerId: principal.userId });
  }

  @Get('public/discovery/search')
  @Public()
  @ZodSerializerDto(SearchResultPageDto)
  @ApiOkResponse({ type: SearchResultPageDto.Output })
  async searchAsVisitor(
    @Query() query: SearchQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CursorPage<DiscoveryCard>> {
    const page = await this.search.search(query, { kind: 'public' });
    response.setHeader('Cache-Control', PUBLIC_CACHE);
    return page;
  }

  @Get('discovery/autocomplete')
  @RequireAction('discovery.search')
  @ZodSerializerDto(AutocompleteResultDto)
  @ApiOkResponse({ type: AutocompleteResultDto.Output })
  autocomplete(
    @CurrentPrincipal() principal: Principal,
    @Query() query: AutocompleteQueryDto,
  ): Promise<{ items: AutocompleteItem[] }> {
    return this.search.autocomplete(query, { kind: 'member', viewerId: principal.userId });
  }

  @Get('public/discovery/autocomplete')
  @Public()
  @ZodSerializerDto(AutocompleteResultDto)
  @ApiOkResponse({ type: AutocompleteResultDto.Output })
  async publicAutocomplete(
    @Query() query: AutocompleteQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ items: AutocompleteItem[] }> {
    const result = await this.search.autocomplete(query, { kind: 'public' });
    response.setHeader('Cache-Control', PUBLIC_CACHE);
    return result;
  }

  /** A list of explained suggestions: people, complementary entrepreneurs, projects... */
  @Get('discovery/suggestions')
  @RequireAction('discovery.suggestions.read')
  @ZodSerializerDto(SuggestionPageDto)
  @ApiOkResponse({ type: SuggestionPageDto.Output })
  list(
    @CurrentPrincipal() principal: Principal,
    @Query() query: SuggestionsQueryDto,
  ): Promise<CursorPage<Suggestion>> {
    return this.suggestions.list(principal.userId, query.list, query);
  }

  /** « Pas intéressé » : the candidate is never suggested again. */
  @Post('discovery/dismissals')
  @RequireAction('discovery.suggestions.dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async dismiss(@CurrentPrincipal() principal: Principal, @Body() body: DismissDto): Promise<void> {
    await this.suggestions.dismiss(principal.userId, body.kind, body.key);
  }

  @Delete('discovery/dismissals/:kind/:key')
  @RequireAction('discovery.suggestions.dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async undoDismissal(
    @CurrentPrincipal() principal: Principal,
    @Param() params: DismissalParamsDto,
  ): Promise<void> {
    await this.suggestions.undoDismissal(principal.userId, params.kind, params.key);
  }

  /** Potential contributors of a project, with their reason, for its team. */
  @Get('projects/:projectId/suggested-contributors')
  @RequireAction('discovery.project-suggestions.read', { resource: ProjectTeamResolver })
  @ZodSerializerDto(SuggestionPageDto)
  @ApiOkResponse({ type: SuggestionPageDto.Output })
  projectContributors(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Query() query: PageQueryDto,
  ): Promise<CursorPage<Suggestion>> {
    return this.suggestions.projectContributors(params.projectId, principal.userId, query);
  }

  /** Every section of the Discover page, first page each. */
  @Get('discovery/page')
  @RequireAction('discovery.page.read')
  @ZodSerializerDto(DiscoverPageDto)
  @ApiOkResponse({ type: DiscoverPageDto.Output })
  page(
    @CurrentPrincipal() principal: Principal,
    @Query() query: DiscoverPageQueryDto,
  ): Promise<DiscoverPage> {
    return this.discover.page({ kind: 'member', viewerId: principal.userId }, query.limit);
  }

  @Get('discovery/sections/:section')
  @RequireAction('discovery.page.read')
  @ZodSerializerDto(DiscoverSectionPageDto)
  @ApiOkResponse({ type: DiscoverSectionPageDto.Output })
  section(
    @CurrentPrincipal() principal: Principal,
    @Param() params: DiscoverSectionParamsDto,
    @Query() query: PageQueryDto,
  ): Promise<DiscoverSectionPage> {
    return this.discover.section(
      params.section,
      { kind: 'member', viewerId: principal.userId },
      query,
    );
  }

  @Get('public/discovery/page')
  @Public()
  @ZodSerializerDto(DiscoverPageDto)
  @ApiOkResponse({ type: DiscoverPageDto.Output })
  async publicPage(
    @Query() query: DiscoverPageQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DiscoverPage> {
    const page = await this.discover.page({ kind: 'public' }, query.limit);
    response.setHeader('Cache-Control', PUBLIC_CACHE);
    return page;
  }

  @Get('public/discovery/sections/:section')
  @Public()
  @ZodSerializerDto(DiscoverSectionPageDto)
  @ApiOkResponse({ type: DiscoverSectionPageDto.Output })
  async publicSection(
    @Param() params: DiscoverSectionParamsDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DiscoverSectionPage> {
    const page = await this.discover.section(params.section, { kind: 'public' }, query);
    response.setHeader('Cache-Control', PUBLIC_CACHE);
    return page;
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import {
  type Contribution,
  contributionIdParamsSchema,
  contributionListQuerySchema,
  contributionPageSchema,
  type ContributionQuote,
  contributionQuoteRequestSchema,
  contributionQuoteSchema,
  contributionSchema,
  createContributionRequestSchema,
  createOrganizationContributionRequestSchema,
  type CursorPage,
  cursorPageQuerySchema,
  organizationIdParamsSchema,
  type PaymentOptions,
  paymentOptionsQuerySchema,
  paymentOptionsSchema,
  type ProjectContribution,
  projectContributionPageSchema,
  projectIdParamsSchema,
  type SupporterPage,
  supporterPageSchema,
} from '@pitchorium/contracts';
import type { Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, Public, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { ContributionsService } from '../application/contributions.service';
import { ExportsService } from '../application/exports.service';
import { QuotesService } from '../application/quotes.service';
import {
  ContributionResolver,
  OrganizationRoleResolver,
  ProjectTeamResolver,
} from './payments.resolvers';

class ProjectIdParamsDto extends createZodDto(projectIdParamsSchema) {}
class OrganizationIdParamsDto extends createZodDto(organizationIdParamsSchema) {}
class ContributionIdParamsDto extends createZodDto(contributionIdParamsSchema) {}
class PaymentOptionsQueryDto extends createZodDto(paymentOptionsQuerySchema) {}
class PaymentOptionsDto extends createZodDto(paymentOptionsSchema) {}
class QuoteRequestDto extends createZodDto(contributionQuoteRequestSchema) {}
class QuoteDto extends createZodDto(contributionQuoteSchema) {}
class CreateContributionDto extends createZodDto(createContributionRequestSchema) {}
class CreateOrganizationContributionDto extends createZodDto(
  createOrganizationContributionRequestSchema,
) {}
class ContributionDto extends createZodDto(contributionSchema) {}
class ContributionPageDto extends createZodDto(contributionPageSchema) {}
class ContributionListQueryDto extends createZodDto(contributionListQuerySchema) {}
class ProjectContributionPageDto extends createZodDto(projectContributionPageSchema) {}
class SupporterPageDto extends createZodDto(supporterPageSchema) {}
class PageQueryDto extends createZodDto(cursorPageQuerySchema) {}

/** The public list of supporters changes with each contribution: a short cache. */
const SUPPORTERS_CACHE = 'public, max-age=60';

/**
 * Contribute (section 9.3): payment options and quote, creation of the payment session on the
 * hosted page of the provider, return, cancellation; the contributions of the member, of a
 * project for its owners (and their CSV export, section 11.3), and the public supporters.
 */
@ApiTags('payments')
@Controller()
export class ContributionsController {
  constructor(
    private readonly quotes: QuotesService,
    private readonly contributions: ContributionsService,
    private readonly exports: ExportsService,
  ) {}

  /** Methods really available to this contributor (declared country) for this project. */
  @Get('projects/:projectId/payment-options')
  @RequireAction('payment.quote')
  @ZodSerializerDto(PaymentOptionsDto)
  @ApiOkResponse({ type: PaymentOptionsDto.Output })
  options(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Query() query: PaymentOptionsQueryDto,
  ): Promise<PaymentOptions> {
    return this.quotes.options(params.projectId, principal.userId, query.country);
  }

  /** Amount, EUR equivalent, commission and estimated fees before paying (section 9.3 step 7). */
  @Post('projects/:projectId/contribution-quotes')
  @RequireAction('payment.quote')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(QuoteDto)
  @ApiOkResponse({ type: QuoteDto.Output })
  quote(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() body: QuoteRequestDto,
  ): Promise<ContributionQuote> {
    return this.quotes.quote(params.projectId, principal.userId, body);
  }

  /** Opens the payment session: `paymentUrl` is the hosted page of the provider. */
  @Post('projects/:projectId/contributions')
  @RequireAction('payment.contribute')
  @Idempotent()
  @ZodSerializerDto(ContributionDto)
  @ApiCreatedResponse({ type: ContributionDto.Output })
  create(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() body: CreateContributionDto,
  ): Promise<Contribution> {
    return this.contributions.create(principal.userId, params.projectId, body);
  }

  /** On behalf of an organization the member owns or administers (section 10.7). */
  @Post('organizations/:organizationId/contributions')
  @RequireAction('payment.contribute.organization', { resource: OrganizationRoleResolver })
  @Idempotent()
  @ZodSerializerDto(ContributionDto)
  @ApiCreatedResponse({ type: ContributionDto.Output })
  createForOrganization(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OrganizationIdParamsDto,
    @Body() body: CreateOrganizationContributionDto,
  ): Promise<Contribution> {
    const { projectId, ...request } = body;
    return this.contributions.create(principal.userId, projectId, request, params.organizationId);
  }

  @Get('me/contributions')
  @RequireAction('payment.contribution.read')
  @ZodSerializerDto(ContributionPageDto)
  @ApiOkResponse({ type: ContributionPageDto.Output })
  mine(
    @CurrentPrincipal() principal: Principal,
    @Query() query: ContributionListQueryDto,
  ): Promise<CursorPage<Contribution>> {
    return this.contributions.mine(principal.userId, query);
  }

  @Get('me/contributions/:contributionId')
  @RequireAction('payment.contribution.read', { resource: ContributionResolver })
  @ZodSerializerDto(ContributionDto)
  @ApiOkResponse({ type: ContributionDto.Output })
  one(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ContributionIdParamsDto,
  ): Promise<Contribution> {
    return this.contributions.view(principal.userId, params.contributionId);
  }

  /** Back from the provider: the state is read again from its API, not from the browser. */
  @Post('me/contributions/:contributionId/return')
  @RequireAction('payment.contribution.read', { resource: ContributionResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(ContributionDto)
  @ApiOkResponse({ type: ContributionDto.Output })
  returned(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ContributionIdParamsDto,
  ): Promise<Contribution> {
    return this.contributions.returned(principal.userId, params.contributionId);
  }

  @Post('me/contributions/:contributionId/cancel')
  @RequireAction('payment.contribution.cancel', { resource: ContributionResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(ContributionDto)
  @ApiOkResponse({ type: ContributionDto.Output })
  cancel(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ContributionIdParamsDto,
  ): Promise<Contribution> {
    return this.contributions.cancel(principal.userId, params.contributionId);
  }

  @Get('projects/:projectId/contributions')
  @RequireAction('payment.project.contributions.read', { resource: ProjectTeamResolver })
  @ZodSerializerDto(ProjectContributionPageDto)
  @ApiOkResponse({ type: ProjectContributionPageDto.Output })
  ofProject(
    @Param() params: ProjectIdParamsDto,
    @Query() query: ContributionListQueryDto,
  ): Promise<CursorPage<ProjectContribution>> {
    return this.contributions.ofProject(params.projectId, query);
  }

  /** CSV (RFC 4180, UTF-8): paid and off-platform contributions, commission, fees, rewards. */
  @Get('projects/:projectId/contributions/export')
  @RequireAction('payment.project.contributions.export', { resource: ProjectTeamResolver })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'CSV file', schema: { type: 'string' } })
  async export(@Param() params: ProjectIdParamsDto, @Res() response: Response): Promise<void> {
    const csv = await this.exports.projectCsv(params.projectId);
    response
      .status(HttpStatus.OK)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="contributions-${params.projectId}.csv"`,
      )
      .setHeader('Cache-Control', 'private, no-store')
      .send(csv);
  }

  /** Supporters who opted in to the public display, without amounts. */
  @Get('public/projects/:projectId/supporters')
  @Public()
  @ZodSerializerDto(SupporterPageDto)
  @ApiOkResponse({ type: SupporterPageDto.Output })
  async supporters(
    @Param() params: ProjectIdParamsDto,
    @Query() query: PageQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SupporterPage> {
    response.setHeader('Cache-Control', SUPPORTERS_CACHE);
    return this.contributions.supporters(params.projectId, query);
  }
}

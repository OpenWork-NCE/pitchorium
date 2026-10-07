import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiProduces, ApiTags } from '@nestjs/swagger';
import {
  type CursorPage,
  declareTimeEntryRequestSchema,
  disputeTimeEntryRequestSchema,
  type ImpactDashboard,
  impactDashboardSchema,
  organizationIdParamsSchema,
  type TimeEntry,
  timeEntryIdParamsSchema,
  timeEntryListQuerySchema,
  timeEntryPageSchema,
  timeEntrySchema,
  uuidV7Schema,
} from '@pitchorium/contracts';
import type { Request, Response } from 'express';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import {
  CurrentPrincipal,
  type Principal,
  type ProtectedResource,
  RequireAction,
  type ResourceResolver,
} from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { OrganizationsFacade } from '../../organizations';
import { EngagementService } from '../application/engagement.service';

class OrganizationIdParamsDto extends createZodDto(organizationIdParamsSchema) {}
class DashboardDto extends createZodDto(impactDashboardSchema) {}
class DeclareTimeEntryDto extends createZodDto(declareTimeEntryRequestSchema) {}
class TimeEntryDto extends createZodDto(timeEntrySchema) {}
class TimeEntryPageDto extends createZodDto(timeEntryPageSchema) {}
class TimeEntryListQueryDto extends createZodDto(timeEntryListQuerySchema) {}
class TimeEntryIdParamsDto extends createZodDto(timeEntryIdParamsSchema) {}
class DisputeTimeEntryDto extends createZodDto(disputeTimeEntryRequestSchema) {}

/** A live organization and the role of the principal in it. */
@Injectable()
export class OrganizationMemberResolver implements ResourceResolver {
  constructor(private readonly organizations: OrganizationsFacade) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = uuidV7Schema.safeParse(request.params['organizationId']);
    if (!id.success || !(await this.organizations.summaries([id.data])).has(id.data)) return null;
    const role = await this.organizations.roleOf(id.data, principal.userId);
    return { type: 'organization', id: id.data, ownerId: null, roles: role ? [role] : [] };
  }
}

/** A time entry: `beneficiary` for the entrepreneur or the owners of the project concerned. */
@Injectable()
export class TimeEntryResolver implements ResourceResolver {
  constructor(private readonly engagement: EngagementService) {}

  async resolve(request: Request, principal: Principal): Promise<ProtectedResource | null> {
    const id = uuidV7Schema.safeParse(request.params['timeEntryId']);
    if (!id.success) return null;
    const entry = await this.engagement.findEntry(id.data);
    if (!entry) return null;
    const beneficiary = await this.engagement.isBeneficiary(entry, principal.userId);
    if (!beneficiary && entry.contributorId !== principal.userId) return null;
    return {
      type: 'time_entry',
      id: id.data,
      ownerId: entry.contributorId,
      roles: beneficiary ? ['beneficiary'] : [],
    };
  }
}

function sendCsv(response: Response, name: string, csv: string): void {
  response
    .status(HttpStatus.OK)
    .setHeader('Content-Type', 'text/csv; charset=utf-8')
    .setHeader('Content-Disposition', `attachment; filename="${name}.csv"`)
    .setHeader('Cache-Control', 'private, no-store')
    .send(csv);
}

/**
 * Impact dashboard (section 9.4): money really given, projects supported, hours declared and
 * confirmed, downloadable history; for a member and for an organization. Shared time log.
 */
@ApiTags('engagement')
@Controller()
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  @Get('me/impact-dashboard')
  @RequireAction('engagement.dashboard.read')
  @ZodSerializerDto(DashboardDto)
  @ApiOkResponse({ type: DashboardDto.Output })
  mine(@CurrentPrincipal() principal: Principal): Promise<ImpactDashboard> {
    return this.engagement.dashboard({ type: 'member', id: principal.userId });
  }

  @Get('me/impact-dashboard/history')
  @RequireAction('engagement.dashboard.read')
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'CSV file', schema: { type: 'string' } })
  async myHistory(
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    sendCsv(
      response,
      'impact-history',
      await this.engagement.historyCsv({ type: 'member', id: principal.userId }),
    );
  }

  @Get('organizations/:organizationId/impact-dashboard')
  @RequireAction('engagement.organization.dashboard.read', { resource: OrganizationMemberResolver })
  @ZodSerializerDto(DashboardDto)
  @ApiOkResponse({ type: DashboardDto.Output })
  organization(@Param() params: OrganizationIdParamsDto): Promise<ImpactDashboard> {
    return this.engagement.dashboard({ type: 'organization', id: params.organizationId });
  }

  @Get('organizations/:organizationId/impact-dashboard/history')
  @RequireAction('engagement.organization.dashboard.read', { resource: OrganizationMemberResolver })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'CSV file', schema: { type: 'string' } })
  async organizationHistory(
    @Param() params: OrganizationIdParamsDto,
    @Res() response: Response,
  ): Promise<void> {
    sendCsv(
      response,
      'impact-history',
      await this.engagement.historyCsv({ type: 'organization', id: params.organizationId }),
    );
  }

  @Post('me/time-entries')
  @RequireAction('engagement.time.declare')
  @Idempotent()
  @ZodSerializerDto(TimeEntryDto)
  @ApiCreatedResponse({ type: TimeEntryDto.Output })
  declare(
    @CurrentPrincipal() principal: Principal,
    @Body() body: DeclareTimeEntryDto,
  ): Promise<TimeEntry> {
    return this.engagement.declare(principal.userId, body);
  }

  @Get('me/time-entries')
  @RequireAction('engagement.time.read')
  @ZodSerializerDto(TimeEntryPageDto)
  @ApiOkResponse({ type: TimeEntryPageDto.Output })
  declared(
    @CurrentPrincipal() principal: Principal,
    @Query() query: TimeEntryListQueryDto,
  ): Promise<CursorPage<TimeEntry>> {
    return this.engagement.declared(principal.userId, query);
  }

  /** Time declared for the member as entrepreneur or for the projects they own. */
  @Get('me/time-entries/received')
  @RequireAction('engagement.time.read')
  @ZodSerializerDto(TimeEntryPageDto)
  @ApiOkResponse({ type: TimeEntryPageDto.Output })
  received(
    @CurrentPrincipal() principal: Principal,
    @Query() query: TimeEntryListQueryDto,
  ): Promise<CursorPage<TimeEntry>> {
    return this.engagement.received(principal.userId, query);
  }

  @Post('time-entries/:timeEntryId/confirm')
  @RequireAction('engagement.time.respond', { resource: TimeEntryResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(TimeEntryDto)
  @ApiOkResponse({ type: TimeEntryDto.Output })
  confirm(
    @CurrentPrincipal() principal: Principal,
    @Param() params: TimeEntryIdParamsDto,
  ): Promise<TimeEntry> {
    return this.engagement.respond(params.timeEntryId, principal.userId, 'confirmed');
  }

  @Post('time-entries/:timeEntryId/dispute')
  @RequireAction('engagement.time.respond', { resource: TimeEntryResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(TimeEntryDto)
  @ApiOkResponse({ type: TimeEntryDto.Output })
  dispute(
    @CurrentPrincipal() principal: Principal,
    @Param() params: TimeEntryIdParamsDto,
    @Body() body: DisputeTimeEntryDto,
  ): Promise<TimeEntry> {
    return this.engagement.respond(params.timeEntryId, principal.userId, 'disputed', body.reason);
  }
}

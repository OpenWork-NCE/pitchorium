import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  createPayoutAccountRequestSchema,
  type CursorPage,
  declareOfflineContributionRequestSchema,
  declareTeamOfflineContributionRequestSchema,
  type KycOverview,
  kycOverviewSchema,
  type KycSubmission,
  kycSubmissionSchema,
  type OfflineContribution,
  offlineContributionIdParamsSchema,
  offlineContributionListQuerySchema,
  offlineContributionPageSchema,
  offlineContributionSchema,
  offlineProofsRequestSchema,
  offlineRejectionRequestSchema,
  type PayoutAccount,
  payoutAccountSchema,
  projectIdParamsSchema,
  submitKycRequestSchema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { OfflineService } from '../application/offline.service';
import { kycView, PayoutService } from '../application/payout.service';
import { OfflineContributionResolver, ProjectTeamResolver } from './payments.resolvers';

class ProjectIdParamsDto extends createZodDto(projectIdParamsSchema) {}
class OfflineIdParamsDto extends createZodDto(offlineContributionIdParamsSchema) {}
class DeclareOfflineDto extends createZodDto(declareOfflineContributionRequestSchema) {}
class DeclareTeamOfflineDto extends createZodDto(declareTeamOfflineContributionRequestSchema) {}
class OfflineDto extends createZodDto(offlineContributionSchema) {}
class OfflinePageDto extends createZodDto(offlineContributionPageSchema) {}
class OfflineListQueryDto extends createZodDto(offlineContributionListQuerySchema) {}
class ProofsDto extends createZodDto(offlineProofsRequestSchema) {}
class RejectionDto extends createZodDto(offlineRejectionRequestSchema) {}
class CreatePayoutAccountDto extends createZodDto(createPayoutAccountRequestSchema) {}
class PayoutAccountDto extends createZodDto(payoutAccountSchema) {}
class SubmitKycDto extends createZodDto(submitKycRequestSchema) {}
class KycSubmissionDto extends createZodDto(kycSubmissionSchema) {}
class KycOverviewDto extends createZodDto(kycOverviewSchema) {}

/**
 * Off-platform contributions (section 9.3 fallback): declared by a contributor or by an owner
 * of the project for a member, confirmed by the other party, proofs attached for the
 * validation by an administrator.
 */
@ApiTags('payments')
@Controller()
export class OfflineContributionsController {
  constructor(private readonly offline: OfflineService) {}

  @Post('projects/:projectId/offline-contributions')
  @RequireAction('payment.offline.declare')
  @Idempotent()
  @ZodSerializerDto(OfflineDto)
  @ApiCreatedResponse({ type: OfflineDto.Output })
  declare(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() body: DeclareOfflineDto,
  ): Promise<OfflineContribution> {
    return this.offline.declare(principal.userId, params.projectId, body);
  }

  @Post('projects/:projectId/team/offline-contributions')
  @RequireAction('payment.offline.declare.team', { resource: ProjectTeamResolver })
  @Idempotent()
  @ZodSerializerDto(OfflineDto)
  @ApiCreatedResponse({ type: OfflineDto.Output })
  declareForMember(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ProjectIdParamsDto,
    @Body() body: DeclareTeamOfflineDto,
  ): Promise<OfflineContribution> {
    const { contributorHandle, ...request } = body;
    return this.offline.declare(principal.userId, params.projectId, request, contributorHandle);
  }

  @Get('projects/:projectId/offline-contributions')
  @RequireAction('payment.project.contributions.read', { resource: ProjectTeamResolver })
  @ZodSerializerDto(OfflinePageDto)
  @ApiOkResponse({ type: OfflinePageDto.Output })
  ofProject(
    @Param() params: ProjectIdParamsDto,
    @Query() query: OfflineListQueryDto,
  ): Promise<CursorPage<OfflineContribution>> {
    return this.offline.list(
      { projectId: params.projectId, ...(query.status ? { status: query.status } : {}) },
      query,
    );
  }

  @Get('me/offline-contributions')
  @RequireAction('payment.contribution.read')
  @ZodSerializerDto(OfflinePageDto)
  @ApiOkResponse({ type: OfflinePageDto.Output })
  mine(
    @CurrentPrincipal() principal: Principal,
    @Query() query: OfflineListQueryDto,
  ): Promise<CursorPage<OfflineContribution>> {
    return this.offline.list(
      { contributorId: principal.userId, ...(query.status ? { status: query.status } : {}) },
      query,
    );
  }

  @Post('offline-contributions/:offlineContributionId/confirm')
  @RequireAction('payment.offline.respond', { resource: OfflineContributionResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(OfflineDto)
  @ApiOkResponse({ type: OfflineDto.Output })
  confirm(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OfflineIdParamsDto,
  ): Promise<OfflineContribution> {
    return this.offline.respond(params.offlineContributionId, principal.userId, 'confirmed');
  }

  @Post('offline-contributions/:offlineContributionId/reject')
  @RequireAction('payment.offline.respond', { resource: OfflineContributionResolver })
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(OfflineDto)
  @ApiOkResponse({ type: OfflineDto.Output })
  reject(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OfflineIdParamsDto,
    @Body() body: RejectionDto,
  ): Promise<OfflineContribution> {
    return this.offline.respond(
      params.offlineContributionId,
      principal.userId,
      'rejected',
      body.reason,
    );
  }

  /** Supporting documents: files of usage `verification_document`, always private. */
  @Put('offline-contributions/:offlineContributionId/proofs')
  @RequireAction('payment.offline.respond', { resource: OfflineContributionResolver })
  @ZodSerializerDto(OfflineDto)
  @ApiOkResponse({ type: OfflineDto.Output })
  proofs(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OfflineIdParamsDto,
    @Body() body: ProofsDto,
  ): Promise<OfflineContribution> {
    return this.offline.addProofs(params.offlineContributionId, principal.userId, body.mediaIds);
  }
}

/** Payout account and KYC of a holder (section 9.5). */
@ApiTags('payments')
@Controller('me')
export class PayoutController {
  constructor(private readonly payout: PayoutService) {}

  @Get('payout-account')
  @RequireAction('payment.payout.configure')
  @ZodSerializerDto(PayoutAccountDto)
  @ApiOkResponse({ type: PayoutAccountDto.Output })
  account(@CurrentPrincipal() principal: Principal): Promise<PayoutAccount> {
    return this.payout.view(principal.userId);
  }

  /** The country of the bank account decides the payment route; `onboardingUrl` when hosted. */
  @Post('payout-account')
  @RequireAction('payment.payout.configure')
  @Idempotent()
  @ZodSerializerDto(PayoutAccountDto)
  @ApiCreatedResponse({ type: PayoutAccountDto.Output })
  create(
    @CurrentPrincipal() principal: Principal,
    @Body() body: CreatePayoutAccountDto,
  ): Promise<PayoutAccount> {
    return this.payout.create(principal.userId, body);
  }

  /** Reads the account again at the provider (return from the hosted onboarding). */
  @Post('payout-account/refresh')
  @RequireAction('payment.payout.configure')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(PayoutAccountDto)
  @ApiOkResponse({ type: PayoutAccountDto.Output })
  refresh(@CurrentPrincipal() principal: Principal): Promise<PayoutAccount> {
    return this.payout.refresh(principal.userId);
  }

  @Get('kyc')
  @RequireAction('payment.kyc.submit')
  @ZodSerializerDto(KycOverviewDto)
  @ApiOkResponse({ type: KycOverviewDto.Output })
  kyc(@CurrentPrincipal() principal: Principal): Promise<KycOverview> {
    return this.payout.kycOverview(principal.userId);
  }

  /** Manual review: private documents (usage `verification_document`) and a certification. */
  @Post('kyc/submissions')
  @RequireAction('payment.kyc.submit')
  @Idempotent()
  @ZodSerializerDto(KycSubmissionDto)
  @ApiCreatedResponse({ type: KycSubmissionDto.Output })
  async submit(
    @CurrentPrincipal() principal: Principal,
    @Body() body: SubmitKycDto,
  ): Promise<KycSubmission> {
    return kycView(await this.payout.submitKyc(principal.userId, body));
  }
}

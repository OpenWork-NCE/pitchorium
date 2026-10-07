import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type AdminContribution,
  adminContributionSchema,
  contributionIdParamsSchema,
  type CursorPage,
  type Discrepancy,
  discrepancyIdParamsSchema,
  discrepancyKindSchema,
  discrepancyListQuerySchema,
  discrepancyPageSchema,
  discrepancySchema,
  kycDecisionRequestSchema,
  type KycSubmission,
  kycSubmissionIdParamsSchema,
  kycSubmissionListQuerySchema,
  kycSubmissionPageSchema,
  kycSubmissionSchema,
  type OfflineContribution,
  offlineContributionIdParamsSchema,
  offlineContributionListQuerySchema,
  offlineContributionPageSchema,
  offlineContributionSchema,
  offlineDecisionRequestSchema,
  type Refund,
  refundRequestSchema,
  refundSchema,
  uuidV7Schema,
} from '@pitchorium/contracts';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';
import { AuditService } from '../../../platform/audit';
import { CurrentPrincipal, type Principal, RequireAction } from '../../../platform/http';
import { Idempotent } from '../../../platform/idempotency';
import { Clock, decodeKeyset, DomainError, encodeKeyset } from '../../../platform/kernel';
import { ProfilesFacade } from '../../profiles';
import { ContributionsService, contributionNotFound } from '../application/contributions.service';
import { OfflineService } from '../application/offline.service';
import { kycView, PayoutService } from '../application/payout.service';
import { refundView } from '../application/payments-views';
import { type DiscrepancyRecord, PaymentsRepository } from '../application/ports';
import { ReconciliationService } from '../application/reconciliation.service';
import { RefundsService } from '../application/refunds.service';

class ContributionIdParamsDto extends createZodDto(contributionIdParamsSchema) {}
class AdminContributionDto extends createZodDto(adminContributionSchema) {}
class RefundRequestDto extends createZodDto(refundRequestSchema) {}
class RefundDto extends createZodDto(refundSchema) {}
class KycIdParamsDto extends createZodDto(kycSubmissionIdParamsSchema) {}
class KycListQueryDto extends createZodDto(kycSubmissionListQuerySchema) {}
class KycPageDto extends createZodDto(kycSubmissionPageSchema) {}
class KycSubmissionDto extends createZodDto(kycSubmissionSchema) {}
class KycDecisionDto extends createZodDto(kycDecisionRequestSchema) {}
class OfflineIdParamsDto extends createZodDto(offlineContributionIdParamsSchema) {}
class OfflineListQueryDto extends createZodDto(offlineContributionListQuerySchema) {}
class OfflinePageDto extends createZodDto(offlineContributionPageSchema) {}
class OfflineDto extends createZodDto(offlineContributionSchema) {}
class OfflineDecisionDto extends createZodDto(offlineDecisionRequestSchema) {}
class DiscrepancyIdParamsDto extends createZodDto(discrepancyIdParamsSchema) {}
class DiscrepancyListQueryDto extends createZodDto(discrepancyListQuerySchema) {}
class DiscrepancyPageDto extends createZodDto(discrepancyPageSchema) {}
class DiscrepancyDto extends createZodDto(discrepancySchema) {}
class ResolveDiscrepancyDto extends createZodDto(
  z.object({ note: z.string().trim().min(1).max(1000) }),
) {}
class ReconciliationReportDto extends createZodDto(
  z.object({
    runId: uuidV7Schema,
    checkedTransactions: z.number().int(),
    discrepancies: z.array(z.object({ kind: discrepancyKindSchema, reference: z.string() })),
  }),
) {}

function discrepancyView(record: DiscrepancyRecord): Discrepancy {
  return {
    id: record.id,
    kind: record.kind,
    provider: record.provider,
    reference: record.reference,
    contributionId: record.contributionId,
    projectId: record.projectId,
    expected: record.expected,
    actual: record.actual,
    status: record.status,
    detectedAt: record.detectedAt.toISOString(),
    resolvedAt: record.resolvedAt?.toISOString() ?? null,
    resolution: record.resolution,
  };
}

/**
 * Back office of the payments (administrators with two-factor authentication): refunds, KYC
 * review, validation of off-platform contributions on proof, reconciliation discrepancies.
 */
@ApiTags('payments-admin')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(
    private readonly payments: PaymentsRepository,
    private readonly contributions: ContributionsService,
    private readonly refunds: RefundsService,
    private readonly payout: PayoutService,
    private readonly offline: OfflineService,
    private readonly reconciliation: ReconciliationService,
    private readonly profiles: ProfilesFacade,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  @Get('contributions/:contributionId')
  @RequireAction('payment.refund')
  @ZodSerializerDto(AdminContributionDto)
  @ApiOkResponse({ type: AdminContributionDto.Output })
  async contribution(@Param() params: ContributionIdParamsDto): Promise<AdminContribution> {
    const row = await this.payments.findContribution(params.contributionId);
    if (!row) throw contributionNotFound();
    const [view] = await this.contributions.projectViews([row]);
    if (!view) throw contributionNotFound();
    const refunds = await this.payments.refundsOf(row.id);
    return { ...view, refunds: refunds.map(refundView) };
  }

  /** Total by default, partial with an amount; the commission is refunded in proportion. */
  @Post('contributions/:contributionId/refunds')
  @RequireAction('payment.refund')
  @Idempotent()
  @ZodSerializerDto(RefundDto)
  @ApiCreatedResponse({ type: RefundDto.Output })
  refund(
    @CurrentPrincipal() principal: Principal,
    @Param() params: ContributionIdParamsDto,
    @Body() body: RefundRequestDto,
  ): Promise<Refund> {
    return this.refunds.refund(params.contributionId, {
      amount: body.amount,
      reason: body.reason,
      requestedBy: principal.userId,
      origin: 'admin',
    });
  }

  @Get('kyc-submissions')
  @RequireAction('payment.kyc.review')
  @ZodSerializerDto(KycPageDto)
  @ApiOkResponse({ type: KycPageDto.Output })
  async kycQueue(@Query() query: KycListQueryDto): Promise<CursorPage<KycSubmission>> {
    const rows = await this.payments.kycSubmissions(
      query.status,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const cards = await this.profiles.memberCards(page.map((row) => row.userId));
    const last = page.at(-1);
    return {
      items: page.map((row) => {
        const card = cards.get(row.userId);
        return {
          ...kycView(row),
          holder: card
            ? {
                handle: card.handle,
                displayName: card.displayName,
                headline: card.headline,
                avatarUrl: card.avatarUrl,
              }
            : null,
        };
      }),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.submittedAt, key: last.id })
          : null,
    };
  }

  /** Documents are read through GET /v1/media/{mediaId}/download-url (administrators). */
  @Get('kyc-submissions/:kycSubmissionId')
  @RequireAction('payment.kyc.review')
  @ZodSerializerDto(KycSubmissionDto)
  @ApiOkResponse({ type: KycSubmissionDto.Output })
  async kycSubmission(@Param() params: KycIdParamsDto): Promise<KycSubmission> {
    const submission = await this.payments.findKycSubmission(params.kycSubmissionId);
    if (!submission) throw new DomainError('PAYMENTS_KYC_NOT_FOUND', 'KYC submission not found');
    return kycView(submission);
  }

  @Post('kyc-submissions/:kycSubmissionId/decision')
  @RequireAction('payment.kyc.review')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(KycSubmissionDto)
  @ApiOkResponse({ type: KycSubmissionDto.Output })
  async decideKyc(
    @CurrentPrincipal() principal: Principal,
    @Param() params: KycIdParamsDto,
    @Body() body: KycDecisionDto,
  ): Promise<KycSubmission> {
    return kycView(
      await this.payout.decideKyc(
        params.kycSubmissionId,
        principal.userId,
        body.decision,
        body.reason,
      ),
    );
  }

  @Get('offline-contributions')
  @RequireAction('payment.offline.validate')
  @ZodSerializerDto(OfflinePageDto)
  @ApiOkResponse({ type: OfflinePageDto.Output })
  offlineQueue(@Query() query: OfflineListQueryDto): Promise<CursorPage<OfflineContribution>> {
    return this.offline.list(query.status ? { status: query.status } : {}, query);
  }

  /** Validation on proof: the money enters the collected amount of the project. */
  @Post('offline-contributions/:offlineContributionId/decision')
  @RequireAction('payment.offline.validate')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(OfflineDto)
  @ApiOkResponse({ type: OfflineDto.Output })
  decideOffline(
    @CurrentPrincipal() principal: Principal,
    @Param() params: OfflineIdParamsDto,
    @Body() body: OfflineDecisionDto,
  ): Promise<OfflineContribution> {
    return this.offline.decide(
      params.offlineContributionId,
      principal.userId,
      body.decision,
      body.reason,
    );
  }

  @Get('discrepancies')
  @RequireAction('payment.reconciliation.manage')
  @ZodSerializerDto(DiscrepancyPageDto)
  @ApiOkResponse({ type: DiscrepancyPageDto.Output })
  async discrepancies(@Query() query: DiscrepancyListQueryDto): Promise<CursorPage<Discrepancy>> {
    const rows = await this.payments.discrepancies(
      query.status,
      decodeKeyset(query.cursor),
      query.limit + 1,
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map(discrepancyView),
      nextCursor:
        rows.length > query.limit && last
          ? encodeKeyset({ at: last.detectedAt, key: last.id })
          : null,
    };
  }

  /** Records how a discrepancy was handled; nothing is corrected automatically. */
  @Post('discrepancies/:discrepancyId/resolve')
  @RequireAction('payment.reconciliation.manage')
  @HttpCode(HttpStatus.OK)
  @ZodSerializerDto(DiscrepancyDto)
  @ApiOkResponse({ type: DiscrepancyDto.Output })
  async resolve(
    @CurrentPrincipal() principal: Principal,
    @Param() params: DiscrepancyIdParamsDto,
    @Body() body: ResolveDiscrepancyDto,
  ): Promise<Discrepancy> {
    const discrepancy = await this.payments.findDiscrepancy(params.discrepancyId);
    if (!discrepancy) {
      throw new DomainError('PAYMENTS_DISCREPANCY_NOT_FOUND', 'Discrepancy not found');
    }
    if (discrepancy.status === 'open') {
      const now = this.clock.now();
      await this.payments.updateDiscrepancy(discrepancy.id, {
        status: 'resolved',
        resolvedAt: now,
        resolvedBy: principal.userId,
        resolution: body.note,
      });
      await this.audit.record({
        actor: { type: 'user', id: principal.userId },
        action: 'payments.discrepancy-resolved',
        target: { type: 'discrepancy', id: discrepancy.id },
        metadata: { kind: discrepancy.kind, note: body.note },
      });
    }
    const saved = await this.payments.findDiscrepancy(discrepancy.id);
    return discrepancyView(saved ?? discrepancy);
  }

  /** Runs the reconciliation now, on the same period as the daily task. */
  @Post('reconciliation-runs')
  @RequireAction('payment.reconciliation.manage')
  @ZodSerializerDto(ReconciliationReportDto)
  @ApiCreatedResponse({ type: ReconciliationReportDto.Output })
  reconcile() {
    return this.reconciliation.run(this.reconciliation.defaultLookbackMs);
  }
}

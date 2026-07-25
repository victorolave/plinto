import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import { z } from 'zod'
import { ObligationPeriodSchema } from '@plinto/shared'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { TenantGuard } from '../../../../../common/guards/tenant.guard'
import { RequirePermission, RoleGuard } from '../../../../../common/guards/role.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import {
  CreateObligationSchema,
  ReconcileObligationSchema,
} from '../../../../../common/shared-schemas'
import { toPeriod } from '../../../../../common/period'
import { ObligationService } from '../../../application/obligation.service'

type CreateObligationBody = z.infer<typeof CreateObligationSchema>
type ReconcileObligationBody = z.infer<typeof ReconcileObligationSchema>

@Controller('obligations')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class ObligationsController {
  constructor(private readonly obligationService: ObligationService) {}

  @Get()
  @RequirePermission('obligation:read')
  async listPeriod(@Req() req: RequestContext, @Query('period') period?: string) {
    const obligations = await this.obligationService.listPeriod(
      req.tenantId as string,
      this.resolvePeriod(period),
    )

    return { data: { obligations } }
  }

  /**
   * Declared before the parameterized routes so `summary` is never captured as
   * an obligation id.
   */
  @Get('summary')
  @RequirePermission('obligation:read')
  async getSummary(@Req() req: RequestContext, @Query('period') period?: string) {
    const summary = await this.obligationService.getPeriodSummary(
      req.tenantId as string,
      this.resolvePeriod(period),
    )

    return { data: { summary } }
  }

  @Post()
  @RequirePermission('obligation:write')
  @UsePipes(new ZodValidationPipe(CreateObligationSchema))
  async createObligation(
    @Req() req: RequestContext,
    @Body() body: CreateObligationBody,
  ) {
    const obligation = await this.obligationService.createManualObligation({
      ...this.contextOf(req),
      name: body.name,
      period: body.period,
      dueDate: body.dueDate,
      expectedAmountMinor: body.expectedAmountMinor,
      currency: body.currency,
    })

    return { data: { obligation } }
  }

  @Post(':id/payments')
  @RequirePermission('obligation:write')
  async reconcile(
    @Req() req: RequestContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReconcileObligationSchema))
    body: ReconcileObligationBody,
  ) {
    const obligation = await this.obligationService.reconcile({
      ...this.contextOf(req),
      obligationId: id,
      transactionId: body.transactionId,
    })

    return { data: { obligation } }
  }

  @Delete(':id/payments/:transactionId')
  @RequirePermission('obligation:write')
  async removePayment(
    @Req() req: RequestContext,
    @Param('id') id: string,
    @Param('transactionId') transactionId: string,
  ) {
    const obligation = await this.obligationService.removePayment({
      ...this.contextOf(req),
      obligationId: id,
      transactionId,
    })

    return { data: { obligation } }
  }

  /** Defaults to the current period, so the board opens on "this month". */
  private resolvePeriod(period?: string): string {
    if (period === undefined) {
      return toPeriod(new Date())
    }

    const result = ObligationPeriodSchema.safeParse(period)

    if (!result.success) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        message: 'Period must be formatted as YYYY-MM',
      })
    }

    return result.data
  }

  private contextOf(req: RequestContext) {
    return {
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
    }
  }
}

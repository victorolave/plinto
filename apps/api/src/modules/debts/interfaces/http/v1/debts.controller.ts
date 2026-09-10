import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import { z } from 'zod'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { TenantGuard } from '../../../../../common/guards/tenant.guard'
import {
  RequirePermission,
  RoleGuard,
} from '../../../../../common/guards/role.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import {
  CreateDebtScheduleSchema,
  UpdateDebtScheduleSchema,
} from '../../../../../common/shared-schemas'
import {
  DebtScheduleService,
  DebtScheduleView,
} from '../../../application/debt-schedule.service'

type CreateDebtScheduleBody = z.infer<typeof CreateDebtScheduleSchema>
type UpdateDebtScheduleBody = z.infer<typeof UpdateDebtScheduleSchema>

/** Flattens the derived figures into the shape the contract publishes. */
function toDto(view: DebtScheduleView) {
  return {
    ...view.schedule,
    paidMinor: view.paidMinor,
    outstandingMinor: view.outstandingMinor,
    settled: view.settled,
  }
}

@Controller('debts')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class DebtsController {
  constructor(private readonly debtScheduleService: DebtScheduleService) {}

  @Get()
  @RequirePermission('debt:read')
  async listDebts(@Req() req: RequestContext) {
    const views = await this.debtScheduleService.listSchedules(req.tenantId as string)

    return { data: { debts: views.map(toDto) } }
  }

  /**
   * Declared before `:id` routes would matter — Nest matches in declaration
   * order, and a later `GET /debts/:id` would otherwise swallow `summary`.
   */
  @Get('summary')
  @RequirePermission('debt:read')
  async summary(@Req() req: RequestContext) {
    const totals = await this.debtScheduleService.summarize(req.tenantId as string)

    return { data: { summary: { totals } } }
  }

  @Post()
  @RequirePermission('debt:write')
  @UsePipes(new ZodValidationPipe(CreateDebtScheduleSchema))
  async createDebt(@Req() req: RequestContext, @Body() body: CreateDebtScheduleBody) {
    const view = await this.debtScheduleService.createSchedule({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
      accountId: body.accountId,
      name: body.name,
      principalMinor: body.principalMinor,
      installmentMinor: body.installmentMinor,
      installmentCount: body.installmentCount,
      firstDueDate: body.firstDueDate,
    })

    return { data: { debt: toDto(view) } }
  }

  /**
   * Only the name. Amounts and dates are snapshotted into the obligations this
   * plan already produced, so editing them would leave those periods expecting
   * one figure while the plan claims another.
   */
  @Patch(':id')
  @RequirePermission('debt:write')
  @UsePipes(new ZodValidationPipe(UpdateDebtScheduleSchema))
  async updateDebt(
    @Req() req: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateDebtScheduleBody,
  ) {
    const schedule = await this.debtScheduleService.rename({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
      id,
      name: body.name,
    })

    return { data: { debt: schedule } }
  }

  /**
   * Cancelled, not deleted. The obligations this plan already produced are
   * real — some of them paid — and removing what produced them would leave a
   * household looking at payments whose reason had vanished.
   */
  @Post(':id/cancel')
  @RequirePermission('debt:write')
  async cancelDebt(@Req() req: RequestContext, @Param('id') id: string) {
    const schedule = await this.debtScheduleService.cancel({
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
      id,
    })

    return { data: { debt: schedule } }
  }
}

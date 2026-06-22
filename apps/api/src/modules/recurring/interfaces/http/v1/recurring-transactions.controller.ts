import { Body, Controller, Get, Post, Req, UseGuards, UsePipes } from '@nestjs/common'
import { z } from 'zod'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { TenantGuard } from '../../../../../common/guards/tenant.guard'
import {
  RequirePermission,
  RoleGuard,
} from '../../../../../common/guards/role.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import { CreateRecurringTransactionRuleSchema } from '../../../../../common/shared-schemas'
import { RecurringTransactionService } from '../../../application/recurring-transaction.service'

type CreateRecurringRuleBody = z.infer<typeof CreateRecurringTransactionRuleSchema>

@Controller('recurring-transactions')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class RecurringTransactionsController {
  constructor(private readonly recurringService: RecurringTransactionService) {}

  @Get()
  @RequirePermission('transaction:read')
  async listRules(@Req() req: RequestContext) {
    const rules = await this.recurringService.listRules(req.tenantId as string)
    return { data: { rules } }
  }

  @Post()
  @RequirePermission('transaction:write')
  @UsePipes(new ZodValidationPipe(CreateRecurringTransactionRuleSchema))
  async createRule(
    @Req() req: RequestContext,
    @Body() body: CreateRecurringRuleBody,
  ) {
    const rule = await this.recurringService.createRule({
      tenantId: req.tenantId as string,
      name: body.name,
      accountId: body.accountId,
      type: body.type,
      amountMinor: body.amountMinor,
      dayOfMonth: body.dayOfMonth,
      startDate: body.startDate,
      active: body.active,
    })
    return { data: { rule } }
  }
}
